import http from "node:http";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { WebSocket, WebSocketServer } from "ws";
import { Store, compatible, type Checkpoint } from "./store";
import {
  joinSchema,
  parseClient,
  VERSION,
  type Actor,
  type Snapshot,
} from "../../packages/protocol";
import {
  generateWorld,
  SPAWN,
  CONTENT_VERSION,
  GENERATION_VERSION,
} from "../../packages/world";
import { step } from "../../packages/simulation";

export async function createGateway(options: {
  redisUrl: string;
  prefix: string;
  origins: string[];
  owner?: string;
  rotationMs?: number;
}) {
  const owner = options.owner ?? randomUUID(),
    store = new Store(options.redisUrl, options.prefix);
  await store.connect();
  const subscriber = store.redis.duplicate();
  subscriber.on("error", () => {});
  await subscriber.connect();
  const metrics = {
    ticks: 0,
    rejected: 0,
    fenced: 0,
    bytes: 0,
    steps: [] as number[],
  };
  type Client = {
    socket: WebSocket;
    world: string;
    player: string;
    generation: number;
    seq: number;
  };
  const clients = new Set<Client>();
  type Room = {
    epoch: number;
    token: string;
    state: Checkpoint;
    renewAt: number;
    started: number;
    cooldown: number;
    busy: boolean;
    lastActive: number;
  };
  const rooms = new Map<string, Room>();
  let stopping = false;
  const httpRates = new Map<string, { count: number; start: number }>();
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !options.origins.includes(origin)) {
      res.writeHead(403).end();
      return;
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    if (req.url === "/health") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: store.redis.isReady,
          owner,
          rooms: rooms.size,
          metrics: {
            ticks: metrics.ticks,
            bytes: metrics.bytes,
            rejected: metrics.rejected,
            fenced: metrics.fenced,
            cpuP95Ms:
              metrics.steps.toSorted((a, b) => a - b)[
                Math.floor(metrics.steps.length * 0.95)
              ] ?? 0,
          },
        }),
      );
      return;
    }
    if (req.method !== "POST" || req.url !== "/session") {
      res.writeHead(404).end();
      return;
    }
    const ip = req.socket.remoteAddress ?? "unknown",
      now = Date.now();
    for (const [key, v] of httpRates)
      if (now - v.start > 60000) httpRates.delete(key);
    const rate = httpRates.get(ip) ?? { count: 0, start: now };
    httpRates.set(ip, rate);
    if (++rate.count > 20 || httpRates.size > 1000) {
      res.writeHead(429).end();
      return;
    }
    try {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 8192) {
          res.writeHead(413).end();
          return;
        }
      }
      const parsed = joinSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        res
          .writeHead(400)
          .end(
            JSON.stringify({ error: "Choose a valid name and invitation." }),
          );
        return;
      }
      const session = parsed.data.invite
        ? await store.join(parsed.data.name, parsed.data.invite)
        : await store.create(parsed.data.name);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(session));
    } catch (error) {
      res.writeHead(store.redis.isReady ? 400 : 503).end(
        JSON.stringify({
          error:
            store.redis.isReady && error instanceof Error
              ? error.message
              : "The Meadow service is reconnecting. Try again shortly.",
        }),
      );
    }
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 8192,
    perMessageDeflate: false,
  });
  server.on("upgrade", (req, socket, head) => {
    if (
      stopping ||
      req.url !== "/play" ||
      !req.headers.origin ||
      !options.origins.includes(req.headers.origin) ||
      wss.clients.size >= 32
    ) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
  function send(socket: WebSocket, data: unknown) {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > 65536) {
      socket.close(1013, "Slow connection");
      return;
    }
    const raw = JSON.stringify(data);
    metrics.bytes += Buffer.byteLength(raw);
    socket.send(raw);
  }
  async function ensureRoom(world: string) {
    if (rooms.has(world)) return;
    if (rooms.size >= 16) throw Error("Gateway busy");
    rooms.set(world, {
      epoch: 0,
      token: "",
      state: { tick: 0, actors: [] },
      renewAt: 0,
      started: 0,
      cooldown: 0,
      busy: false,
      lastActive: Date.now(),
    });
    await subscriber.subscribe(store.key(world, "snapshots"), (raw) => {
      const projection = JSON.parse(raw) as Omit<Snapshot, "selfId">;
      for (const c of clients) {
        if (c.world !== world) continue;
        const self = projection.actors.find((a) => a.id === c.player);
        if (self && self.generation > c.generation) {
          c.socket.close(4001, "This adventurer resumed elsewhere");
          continue;
        }
        if (!self || self.generation < c.generation) continue;
        send(c.socket, {
          ...projection,
          selfId: c.player,
          actors: projection.actors.filter(
            (a) =>
              a.id === c.player ||
              Math.hypot(
                a.position.x - self.position.x,
                a.position.y - self.position.y,
              ) <= 48,
          ),
        });
      }
    });
  }
  wss.on("connection", (socket) => {
    let client: Client | undefined,
      authenticating = false,
      busy = false,
      tokens = 40,
      rateAt = performance.now();
    const deadline = setTimeout(
      () => socket.close(4000, "Hello timeout"),
      5000,
    );
    socket.on("error", () => {});
    let queued: NonNullable<ReturnType<typeof parseClient>> | undefined;
    socket.on("message", (raw, binary) => {
      const now = performance.now();
      tokens = Math.min(40, tokens + (now - rateAt) * 0.03);
      rateAt = now;
      if (binary || --tokens < 0) {
        metrics.rejected++;
        socket.close(4000, "Invalid traffic");
        return;
      }
      const message = parseClient(raw.toString());
      if (!message) {
        metrics.rejected++;
        socket.close(4000, "Invalid message");
        return;
      }
      if (busy) {
        if (
          client &&
          message.worldId === client.world &&
          message.type === "resync"
        )
          return;
        if (
          client &&
          message.type === "input" &&
          message.worldId === client.world &&
          message.generation === client.generation &&
          message.seq > client.seq &&
          (queued?.type !== "input" || message.seq > queued.seq)
        ) {
          queued = message;
          return;
        }
        metrics.rejected++;
        socket.close(4000, "Invalid pending input");
        return;
      }
      void processMessage(message);
    });
    async function processMessage(
      message: NonNullable<ReturnType<typeof parseClient>>,
    ) {
      busy = true;
      try {
        if (!client) {
          if (message.type !== "hello" || authenticating)
            throw Error("Hello required");
          authenticating = true;
          const player = await store.authenticate(
            message.worldId,
            message.token,
          );
          if (!player) {
            socket.close(4003, "Session expired");
            return;
          }
          const generation = await store.attach(message.worldId, player);
          if (socket.readyState !== WebSocket.OPEN) return;
          client = {
            socket,
            world: message.worldId,
            player,
            generation,
            seq: 0,
          };
          clients.add(client);
          await store.input(client.world, player, generation, 0, 0, 0);
          await ensureRoom(client.world);
          clearTimeout(deadline);
          send(socket, {
            type: "connected",
            gateway: owner,
            protocolVersion: VERSION,
            worldId: client.world,
            generation,
          });
        } else {
          if (message.worldId !== client.world) throw Error("Wrong world");
          if (message.type === "input") {
            if (
              message.generation !== client.generation ||
              message.seq <= client.seq
            )
              throw Error("Stale input");
            client.seq = message.seq;
            if (
              !(await store.input(
                client.world,
                client.player,
                client.generation,
                message.seq,
                message.movement.x,
                message.movement.y,
              ))
            )
              socket.close(4001, "This adventurer resumed elsewhere");
          } else if (message.type !== "resync") throw Error("Unexpected hello");
          // Full projections arrive every 100ms; resync requires no delta/cache machinery.
        }
      } catch {
        metrics.rejected++;
        socket.close(store.redis.isReady ? 4000 : 1013, "Session unavailable");
      } finally {
        busy = false;
        const next = queued;
        queued = undefined;
        if (next && socket.readyState === WebSocket.OPEN)
          void processMessage(next);
      }
    }
    socket.on("close", () => {
      clearTimeout(deadline);
      if (client) clients.delete(client);
    });
  });
  async function run(worldId: string, room: Room) {
    if (room.busy || stopping || Date.now() < room.cooldown) return;
    room.busy = true;
    try {
      const now = Date.now();
      if (!room.epoch) {
        const epoch = await store.acquire(worldId, owner);
        if (!epoch) {
          room.cooldown = now + 500;
          return;
        }
        room.epoch = epoch;
        room.token = `${owner}:${epoch}`;
        room.started = now;
        room.renewAt = now + 3000;
        const loaded = await store.read(worldId);
        room.state = loaded.checkpoint ?? { tick: 0, actors: [] };
      }
      if (now >= room.renewAt) {
        if (!(await store.renew(worldId, room.token))) throw Error("Fenced");
        room.renewAt = now + 3000;
      }
      const data = await store.read(worldId);
      if (!data.meta || !compatible(data.meta)) {
        await store.release(worldId, room.token);
        room.epoch = 0;
        return;
      }
      const active = data.members.some(
        (m) => data.inputs[m.id] && data.now - data.inputs[m.id].at < 3000,
      );
      if (active) room.lastActive = now;
      if (!active && now - room.lastActive > 5000) {
        await store.release(worldId, room.token);
        room.epoch = 0;
        room.cooldown = now + 1000;
        return;
      }
      const world = generateWorldCached(data.meta.seed);
      const start = performance.now();
      const actors: Actor[] = data.members.map((m, index) => {
        const prior = room.state.actors.find((a) => a.id === m.id),
          input = data.inputs[m.id];
        const position = prior?.position ?? { x: SPAWN.x + index, y: SPAWN.y };
        return {
          id: m.id,
          name: m.name,
          position: step(
            world,
            position,
            input && data.now - input.at < 250 ? input : { x: 0, y: 0 },
          ),
          generation: input?.generation ?? prior?.generation ?? 0,
          ack: input?.seq ?? prior?.ack ?? 0,
        };
      });
      metrics.steps.push(performance.now() - start);
      if (metrics.steps.length > 12000) metrics.steps.shift();
      const state = { tick: room.state.tick + 1, actors };
      const projection =
        state.tick % 2 === 0
          ? JSON.stringify({
              type: "snapshot",
              full: true,
              protocolVersion: VERSION,
              worldId,
              seed: data.meta.seed,
              contentVersion: CONTENT_VERSION,
              generationVersion: GENERATION_VERSION,
              epoch: room.epoch,
              tick: state.tick,
              owner,
              actors: actors.filter(
                (a) =>
                  data.inputs[a.id] && data.now - data.inputs[a.id].at < 3000,
              ),
            })
          : null;
      if (!(await store.commit(worldId, room.token, state, projection))) {
        metrics.fenced++;
        throw Error("Fenced");
      }
      room.state = state;
      metrics.ticks++;
      if (options.rotationMs && now - room.started > options.rotationMs) {
        await store.release(worldId, room.token);
        room.epoch = 0;
        room.cooldown = now + 1500;
      }
    } catch {
      room.epoch = 0;
      room.cooldown = Date.now() + 500;
    } finally {
      room.busy = false;
    }
  }
  const timer = setInterval(() => {
    for (const [world, room] of rooms) {
      void run(world, room);
      if (
        !room.epoch &&
        !room.busy &&
        Date.now() - room.lastActive > 10000 &&
        !Array.from(clients).some((c) => c.world === world)
      ) {
        rooms.delete(world);
        void subscriber
          .unsubscribe(store.key(world, "snapshots"))
          .catch(() => {});
      }
    }
  }, 50);
  return {
    server,
    acceptSocket(socket: WebSocket) {
      if (stopping || wss.clients.size >= 32) {
        socket.close(1013, "Gateway busy");
        return;
      }
      wss.clients.add(socket);
      socket.once("close", () => wss.clients.delete(socket));
      wss.emit("connection", socket);
    },
    store,
    owner,
    metrics,
    rooms,
    async close() {
      stopping = true;
      clearInterval(timer);
      for (const ws of wss.clients) ws.close(1012, "Gateway rotating");
      while (Array.from(rooms.values()).some((r) => r.busy))
        await new Promise((r) => setTimeout(r, 10));
      for (const [world, r] of rooms)
        if (r.token) await store.release(world, r.token).catch(() => {});
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      subscriber.destroy();
      await store.close();
    },
  };
}
const worlds = new Map<string, ReturnType<typeof generateWorld>>();
function generateWorldCached(seed: string) {
  let w = worlds.get(seed);
  if (!w) {
    w = generateWorld(seed);
    worlds.set(seed, w);
  }
  return w;
}
