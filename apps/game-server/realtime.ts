import { teleportTo } from "../../packages/simulation/travel";
import { receipts, type DurableCommand } from "./durable";
import { DurableStore, valuableDigest, type DurableState } from "./durable";
import {
  commandDissolve,
  stepUtility,
} from "../../packages/simulation/utility";
import {
  freshTaming,
  commandCompanion,
  stepTaming,
  publicMoss,
  type TamingState,
} from "../../packages/simulation/taming";
import type {
  CompanionCommand,
  CompanionReceipt,
} from "../../packages/protocol/taming";
import {
  freshCombat,
  freshSlime,
  stepCombat,
  combatBusy,
} from "../../packages/simulation/combat";
import type { Slime } from "../../packages/protocol/combat";
import { encodeDepletion } from "../../packages/protocol/resources";
import {
  emptyGathering,
  gather,
  type GatheringState,
} from "../../packages/simulation/gathering";
import { freshProgress, type GatherCommand } from "../../packages/content";
import {
  resourceNodes,
  type ResourceNode,
} from "../../packages/world/resources";
import { MAX_PLAYERS } from "../../packages/protocol/capacity";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { WebSocket, WebSocketServer } from "ws";
import { Store, compatible } from "./store";
import { joinSchema } from "../../packages/protocol";
import {
  parsePacket,
  REALTIME_VERSION,
  type Run,
  type RealtimeActor,
} from "../../packages/protocol/realtime";
import { generateWorld, SPAWN } from "../../packages/world";
import { InputTimeline } from "../../packages/simulation/realtime";

// All Redis work is outside the fixed simulation step. Only fenced commits are published.
export async function createRealtimeGateway(options: {
  databaseUrl?: string;
  redisUrl: string;
  prefix: string;
  origins: string[];
  owner?: string;
  socketAgeMs?: number;
}) {
  const owner = options.owner ?? randomUUID(),
    store = new Store(
      options.redisUrl,
      options.prefix,
      1800,
      MAX_PLAYERS,
      options.databaseUrl
        ? new DurableStore(options.databaseUrl, options.prefix)
        : undefined,
    );
  try {
    await store.connect();
  } catch (error) {
    await store.close();
    throw error;
  }
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
    qol: boolean;
    socket: WebSocket;
    world: string;
    player: string;
    generation: number;
  };
  type State = {
    durableRevision?: number;
    tick: number;
    actors: RealtimeActor[];
    gathering: GatheringState;
    slime?: Slime;
    taming?: TamingState;
  };
  type Room = {
    journal: DurableCommand[];
    durableRevision: number;
    durableDigest: string;
    lastDurableSave: number;
    lastPublishedRevision: number;
    epoch: number;
    token: string;
    state: State;
    world: ReturnType<typeof generateWorld>;
    seed: string;
    nodes: Map<string, ResourceNode>;
    companions: Map<string, { command: CompanionCommand; generation: number }>;
    gathers: Map<string, { command: GatherCommand; generation: number }>;
    timelines: Map<string, InputTimeline>;
    seen: Map<string, number>;
    busy: boolean;
    commitBusy: boolean;
    leaseUntil: number;
    renewAt: number;
    nextAttempt: number;
    lastStep: number;
    lastCommit: number;
    committed: State;
    loading?: Promise<void>;
    ready: Promise<void>;
  };
  const clients = new Set<Client>(),
    rooms = new Map<string, Room>();
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
        ? await store.join(
            parsed.data.name,
            parsed.data.invite,
            parsed.data.character,
          )
        : await store.create(parsed.data.name, parsed.data.character);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(session));
    } catch (error) {
      res.writeHead(store.redis.isReady ? 400 : 503).end(
        JSON.stringify({
          error:
            !store.durable && store.redis.isReady && error instanceof Error
              ? error.message
              : `This Meadow is unavailable or full (${MAX_PLAYERS} adventurers). Try again shortly.`,
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

  async function refresh(worldId: string, r: Room) {
    const [loaded, gens] = await Promise.all([
      store.read(worldId),
      store.redis.hGetAll(store.key(worldId, "generations")),
    ]);
    if (!compatible(loaded.meta)) throw Error("Expired room");
    r.seed = loaded.meta!.seed;
    r.world = generateWorld(r.seed);
    r.nodes = new Map(resourceNodes(r.world).map((n) => [n.id, n]));
    r.state = { ...r.state, taming: r.state.taming ?? freshTaming(r.seed) };
    r.state = { ...r.state, slime: r.state.slime ?? freshSlime(r.seed) };
    r.state = {
      ...r.state,
      gathering: {
        ...r.state.gathering,
        players: { ...r.state.gathering.players },
      },
    };
    for (const member of loaded.members)
      r.state.gathering.players[member.id] ??= freshProgress();
    r.state.actors = loaded.members.map((m, index) => {
      const prior = r.state.actors.find((a) => a.id === m.id),
        generation = Number(gens[m.id] ?? 0);
      if (prior?.generation === generation) return prior;
      r.timelines.set(m.id, new InputTimeline());
      r.gathers.delete(m.id);
      r.companions.delete(m.id);
      const committed = (
        loaded.checkpoint?.actors as RealtimeActor[] | undefined
      )?.find((a) => a.id === m.id);
      return {
        id: m.id,
        name: m.name,
        character: m.character,
        position: committed?.position ?? {
          x: SPAWN.x + 2 * (m.spawnIndex ?? index),
          y: SPAWN.y,
        },
        generation,
        ack: 0,
        facing: committed?.facing ?? 2,
        moving: false,
        action:
          committed?.action?.kind === "attack" ||
          committed?.action?.kind === "dodge"
            ? committed.action
            : null,
        combat:
          committed?.combat ??
          freshCombat({ x: SPAWN.x + 2 * (m.spawnIndex ?? index), y: SPAWN.y }),
      };
    });
  }
  async function ensureRoom(world: string) {
    const existing = rooms.get(world);
    if (existing) {
      await existing.ready;
      if (rooms.get(world) !== existing) return ensureRoom(world);
      return;
    }
    if (rooms.size >= 16) throw Error("Gateway busy");
    const r: Room = {
      journal: [],
      durableRevision: 0,
      durableDigest: "",
      lastDurableSave: 0,
      lastPublishedRevision: 0,
      epoch: 0,
      token: "",
      state: { tick: 0, actors: [], gathering: emptyGathering() },
      committed: { tick: 0, actors: [], gathering: emptyGathering() },
      seed: "meadow-001",
      world: generateWorld("meadow-001"),
      nodes: new Map(),
      gathers: new Map(),
      companions: new Map(),
      timelines: new Map(),
      seen: new Map(),
      busy: false,
      commitBusy: false,
      leaseUntil: 0,
      renewAt: 0,
      nextAttempt: 0,
      lastStep: performance.now(),
      lastCommit: 0,
      ready: Promise.resolve(),
    };
    rooms.set(world, r);
    r.ready = (async () => {
      await subscriber.subscribe(store.key(world, "snapshots"), (raw) => {
        const projection = JSON.parse(raw) as {
          actors: RealtimeActor[];
          roster: Pick<
            RealtimeActor,
            "id" | "name" | "character" | "position"
          >[];
          companionReceipts: Record<string, CompanionReceipt>;
          gathering: { players: GatheringState["players"]; depleted: string };
        };
        const { gathering, companionReceipts, roster, ...publicProjection } =
          projection;
        for (const c of clients) {
          if (c.world !== world) continue;
          const self = projection.actors.find((a) => a.id === c.player);
          if (self && self.generation > c.generation) {
            c.socket.close(4001, "This adventurer resumed elsewhere");
            continue;
          }
          if (!self || self.generation !== c.generation) continue;
          send(c.socket, {
            ...publicProjection,
            ...(c.qol ? { roster } : {}),
            progress: gathering.players[c.player],
            depleted: gathering.depleted,
            selfId: c.player,
            companionReceipt: companionReceipts?.[c.player],
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
      await subscriber.subscribe(store.key(world, "commands"), (raw) => {
        if (!r.epoch || r.leaseUntil <= performance.now()) return;
        // This channel is private to authenticated gateways; identity is never supplied by a client.
        const data = JSON.parse(raw) as {
          player: string;
          generation: number;
          runs: Run[];
          disconnected?: boolean;
          gather?: GatherCommand;
          companion?: CompanionCommand;
        };
        const actor = r.state.actors.find((a) => a.id === data.player);
        if (!actor || actor.generation < data.generation) {
          r.loading ??= refresh(world, r)
            .catch(() => {
              r.leaseUntil = 0;
            })
            .finally(() => {
              r.loading = undefined;
            });
          return; // Client resends unacknowledged frames; nothing is lost on this race.
        }
        if (actor.generation !== data.generation) return;
        if (data.disconnected) {
          r.seen.delete(actor.id);
          if (r.state.taming?.gate.channel?.player === actor.id)
            r.state = {
              ...r.state,
              taming: stepUtility(
                r.world,
                r.state.taming,
                r.state.actors,
                new Set(),
                r.state.tick,
              ),
            };
          return;
        }
        r.seen.set(actor.id, performance.now());
        try {
          r.timelines.get(actor.id)!.enqueue(data.runs, actor.ack);
          if (data.companion && !r.companions.has(actor.id))
            r.companions.set(actor.id, {
              command: data.companion,
              generation: data.generation,
            });
          if (data.gather && !r.gathers.has(actor.id))
            r.gathers.set(actor.id, {
              command: data.gather,
              generation: data.generation,
            });
        } catch {
          metrics.rejected++;
        }
      });
    })();
    return r.ready;
  }
  wss.on("connection", (socket) => {
    let client: Client | undefined,
      authenticating = false,
      publishing = false;
    let queued:
        | { runs: Run[]; gather?: GatherCommand; companion?: CompanionCommand }
        | undefined,
      tokens = 40,
      rateAt = performance.now();
    const deadline = setTimeout(
      () => socket.close(4000, "Hello timeout"),
      5000,
    );
    const rotation = setTimeout(
      () => send(socket, { type: "renew" }),
      options.socketAgeMs ?? 240000,
    );
    socket.on("error", () => {});
    async function publish() {
      if (publishing || !client) return;
      publishing = true;
      try {
        while (queued && socket.readyState === WebSocket.OPEN) {
          const batch = queued;
          queued = undefined;
          const ok = await store.redis.eval(
            `if tonumber(redis.call('HGET',KEYS[1],ARGV[1]))~=tonumber(ARGV[2]) then return 0 end
     redis.call('PUBLISH',KEYS[2],ARGV[3]); return 1`,
            {
              keys: [
                store.key(client.world, "generations"),
                store.key(client.world, "commands"),
              ],
              arguments: [
                client.player,
                String(client.generation),
                JSON.stringify({
                  player: client.player,
                  generation: client.generation,
                  ...batch,
                }),
              ],
            },
          );
          if (ok !== 1) socket.close(4001, "This adventurer resumed elsewhere");
        }
      } catch {
        socket.close(1013, "Sync unavailable");
      } finally {
        publishing = false;
      }
    }
    socket.on("message", (raw, binary) => {
      const now = performance.now();
      tokens = Math.min(40, tokens + (now - rateAt) * 0.06);
      rateAt = now;
      const message = !binary && parsePacket(raw.toString());
      if (--tokens < 0 || !message) {
        metrics.rejected++;
        socket.close(4000, "Invalid traffic");
        return;
      }
      if (!client) {
        if (authenticating || message.type !== "hello") {
          socket.close(4000, "Hello required");
          return;
        }
        authenticating = true;
        void (async () => {
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
            qol: message.qol === true,
          };
          clients.add(client);
          await ensureRoom(client.world);
          clearTimeout(deadline);
          send(socket, {
            type: "connected",
            protocolVersion: REALTIME_VERSION,
            worldId: client.world,
            generation,
            gateway: owner,
          });
        })().catch(() => socket.close(1013, "Session unavailable"));
        return;
      }
      if (
        message.type !== "frames" ||
        message.worldId !== client.world ||
        message.generation !== client.generation
      ) {
        metrics.rejected++;
        socket.close(4000, "Invalid session");
        return;
      }
      // The latest batch includes every unacknowledged frame, including discrete actions.
      queued = {
        runs: message.runs,
        gather: message.gather,
        companion: message.companion,
      };
      void publish();
    });
    socket.on("close", () => {
      clearTimeout(deadline);
      clearTimeout(rotation);
      if (client) {
        clients.delete(client);
        void store.redis
          .publish(
            store.key(client.world, "commands"),
            JSON.stringify({
              player: client.player,
              generation: client.generation,
              runs: [],
              disconnected: true,
            }),
          )
          .catch(() => {});
      }
    });
  });
  async function maintain(world: string, r: Room) {
    if (r.busy || stopping || r.commitBusy) return;
    r.busy = true;
    try {
      const now = performance.now(),
        local = [...clients].some((c) => c.world === world);
      if (!local) {
        if (r.token) await store.release(world, r.token);
        r.epoch = 0;
        r.leaseUntil = 0;
        if ([...clients].some((c) => c.world === world)) return;
        r.ready = (async () => {
          await subscriber.unsubscribe([
            store.key(world, "commands"),
            store.key(world, "snapshots"),
          ]);
          if (rooms.get(world) === r) rooms.delete(world);
        })();
        await r.ready;
        return;
      }
      if (!r.epoch || now >= r.leaseUntil) {
        r.epoch = 0;
        if (now < r.nextAttempt) return;
        r.nextAttempt = now + 200;
        const claimOwner = randomUUID();
        const epoch = await store.acquire(world, claimOwner);
        if (!epoch) return;
        r.token = `${claimOwner}:${epoch}`;
        const loaded = await store.read(world);
        r.state = (loaded.checkpoint as State) ?? {
          tick: 0,
          actors: [],
          gathering: emptyGathering(),
        };
        let durableEpoch = epoch;
        if (store.durable) {
          durableEpoch = await store.durable.claim(world, r.token);
          const saved = await store.durable.load(world);
          if (!saved) throw Error("Durable world missing");
          // A hot checkpoint may contain newer poses, but never supersedes a committed consequence.
          if (!saved.state || r.state.durableRevision !== saved.revision)
            r.state = (saved.state as State | null) ?? {
              tick: 0,
              actors: [],
              gathering: emptyGathering(),
            };
          r.durableRevision = saved.revision;
          r.durableDigest = saved.digest ?? "";
          r.lastDurableSave = 0;
        }
        r.journal = [];
        r.committed = r.state;
        r.timelines.clear();
        r.gathers.clear();
        r.companions.clear();
        r.seen.clear();
        await refresh(world, r);
        for (const a of r.state.actors) {
          r.timelines.set(a.id, new InputTimeline());
          r.seen.set(a.id, performance.now());
        }
        r.epoch = durableEpoch;
        r.leaseUntil = now + 1800;
        r.renewAt = now + 400;
        r.lastStep = performance.now();
      } else if (now >= r.renewAt) {
        if (!(await store.renew(world, r.token))) throw Error("Fenced");
        r.leaseUntil = now + 1800;
        r.renewAt = now + 400;
      }
    } catch {
      r.epoch = 0;
      r.leaseUntil = 0;
      r.nextAttempt = performance.now() + 200;
    } finally {
      r.busy = false;
    }
  }
  async function commit(world: string, r: Room) {
    if (r.commitBusy || !r.epoch || r.loading) return;
    r.commitBusy = true;
    const journal = r.journal.slice();
    const state = r.state,
      token = r.token,
      epoch = r.epoch;
    try {
      if (store.durable) {
        const nextDigest = valuableDigest(state as DurableState);
        if (
          nextDigest !== r.durableDigest ||
          performance.now() - r.lastDurableSave >= 5000
        ) {
          const revision = await store.durable.commit(
            world,
            token,
            r.durableRevision,
            state,
            journal,
          );
          r.journal.splice(0, journal.length);
          r.durableRevision = revision;
          r.durableDigest = nextDigest;
          r.lastDurableSave = performance.now();
        }
      }
      const checkpoint = { ...state, durableRevision: r.durableRevision };
      const projection = {
        type: "snapshot",
        protocolVersion: REALTIME_VERSION,
        worldId: world,
        seed: r.seed,
        epoch,
        tick: state.tick,
        owner,
        slime: state.slime,
        gate: state.taming?.gate,
        moss: state.taming?.creatures.map(publicMoss),
        companionReceipts: state.taming?.receipts ?? {},
        gathering: {
          players: state.gathering.players,
          depleted: encodeDepletion(
            [...r.nodes.values()],
            state.gathering.depleted,
          ),
        },
        roster: state.actors
          .filter((a) => performance.now() - (r.seen.get(a.id) ?? 0) < 3000)
          .map(({ id, name, character, position }) => ({
            id,
            name,
            character,
            position,
          })),
        actors: state.actors.filter(
          (a) => performance.now() - (r.seen.get(a.id) ?? 0) < 3000,
        ),
      };
      const ok = await store.redis.eval(
        `if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
    local cp=cjson.decode(ARGV[2]); for _,a in ipairs(cp.actors) do
     if tonumber(redis.call('HGET',KEYS[3],a.id) or '0')~=a.generation then return 2 end end
    redis.call('SET',KEYS[2],ARGV[2],'EX',1800)
    for i=3,5 do redis.call('EXPIRE',KEYS[i],1800) end
    redis.call('PUBLISH',KEYS[6],ARGV[3]);return 1`,
        {
          keys: [
            "lease",
            "checkpoint",
            "generations",
            "meta",
            "members",
            "snapshots",
          ].map((k) => store.key(world, k)),
          arguments: [
            token,
            JSON.stringify(checkpoint),
            JSON.stringify(projection),
          ],
        },
      );
      if (r.token !== token) return;
      if (ok === 2) {
        r.loading ??= refresh(world, r).finally(() => {
          r.loading = undefined;
        });
        await r.loading;
      } else if (ok !== 1) {
        metrics.fenced++;
        r.leaseUntil = 0;
        r.epoch = 0;
      } else {
        r.committed = state;
        if (store.durable && r.lastPublishedRevision < r.durableRevision) {
          r.lastPublishedRevision = r.durableRevision;
          void store.durable.published(world, r.durableRevision).catch(() => {
            r.lastPublishedRevision = 0;
          });
        }
      }
    } catch {
      if (r.token === token) {
        r.leaseUntil = 0;
        r.epoch = 0;
      }
    } finally {
      r.commitBusy = false;
    }
  }
  const timer = setInterval(() => {
    const now = performance.now();
    for (const [world, r] of rooms) {
      void maintain(world, r);
      if (!r.epoch || now >= r.leaseUntil || r.loading) {
        r.lastStep = now;
        continue;
      }
      // No catch-up burst after an event-loop stall. This clock is independent of Redis latency.
      let count = 0;
      while (
        now - r.lastStep >= 1000 / 60 &&
        count++ < 6 &&
        r.journal.length < 1024
      ) {
        const priorReceipts = store.durable
          ? receipts(r.state as DurableState)
          : [];
        r.lastStep += 1000 / 60;
        r.world = { ...r.world, gateOpen: r.state.taming?.gate.open ?? false };
        const tick = r.state.tick + 1,
          start = performance.now();
        r.state = {
          ...r.state,
          tick,
          actors: r.state.actors.map((a) =>
            r.timelines
              .get(a.id)!
              .advance(
                r.world,
                a,
                tick,
                tick >= (r.state.gathering.players[a.id]?.readyTick ?? 0) &&
                  r.state.gathering.players[a.id]?.inventory.some(
                    (s) => s?.item === "starter-blade",
                  ),
              ),
          ),
        };
        const combat = stepCombat(
          r.world,
          r.state.actors,
          r.state.slime!,
          tick,
          new Set(
            r.state.actors
              .filter((a) => now - (r.seen.get(a.id) ?? 0) < 3000)
              .map((a) => a.id),
          ),
        );
        r.state = { ...r.state, ...combat };
        for (const [player, pending] of r.gathers) {
          const { command, generation } = pending;
          const actor = r.state.actors.find((a) => a.id === player);
          if (!actor || actor.generation !== generation) continue;
          const prior = r.state.gathering;
          const next = gather(
            r.world,
            r.nodes,
            prior,
            player,
            actor.position,
            command,
            tick,
            actor.combat?.health === 0
              ? "dead"
              : combatBusy(actor.combat, tick)
                ? "busy"
                : undefined,
          );
          r.state = { ...r.state, gathering: next };
          if (
            next !== prior &&
            next.players[player].receipt?.result === "gathered"
          )
            r.state.actors = r.state.actors.map((a) =>
              a.id === player
                ? {
                    ...a,
                    action: {
                      kind: "gather",
                      resource: r.nodes.get(command.target)!.kind,
                      seq: command.seq,
                      generation: a.generation,
                      startedTick: tick,
                    },
                  }
                : a,
            );
        }
        r.gathers.clear();
        for (const [player, pending] of r.companions) {
          const actor = r.state.actors.find((a) => a.id === player);
          if (actor && actor.generation === pending.generation)
            r.state = {
              ...r.state,
              ...(pending.command.action === "teleport"
                ? teleportTo(
                    r.world,
                    r.state.taming!,
                    r.state.actors,
                    actor.id,
                    pending.command,
                    new Set(
                      [...r.seen]
                        .filter(([, at]) => now - at < 3000)
                        .map(([id]) => id),
                    ),
                    tick,
                  )
                : pending.command.action === "dissolve"
                  ? {
                      taming: commandDissolve(
                        r.world,
                        r.state.taming!,
                        actor,
                        pending.command,
                        tick,
                      ),
                    }
                  : commandCompanion(
                      r.world,
                      r.state.taming!,
                      r.state.gathering,
                      actor,
                      pending.command,
                      tick,
                    )),
            };
        }
        r.companions.clear();
        r.state = {
          ...r.state,
          taming: stepTaming(
            r.world,
            r.state.taming!,
            r.state.actors,
            new Set(
              r.state.actors
                .filter((a) => now - (r.seen.get(a.id) ?? 0) < 3000)
                .map((a) => a.id),
            ),
            tick,
          ),
        };
        r.state = {
          ...r.state,
          taming: stepUtility(
            r.world,
            r.state.taming!,
            r.state.actors,
            new Set(
              r.state.actors
                .filter((a) => now - (r.seen.get(a.id) ?? 0) < 3000)
                .map((a) => a.id),
            ),
            tick,
          ),
        };
        if (store.durable)
          for (const entry of receipts(r.state as DurableState)) {
            if (
              !priorReceipts.some(
                (p) =>
                  p.actor === entry.actor &&
                  p.stream === entry.stream &&
                  p.result === entry.result,
              )
            )
              r.journal.push(entry);
          }
        metrics.ticks++;
        metrics.steps.push(performance.now() - start);
        if (metrics.steps.length > 12000) metrics.steps.shift();
      }
      if (count > 6) r.lastStep = now;
      if (now - r.lastCommit >= 50) {
        r.lastCommit = now;
        void commit(world, r);
      }
    }
  }, 8);
  return {
    server,
    store,
    owner,
    metrics,
    rooms,
    acceptSocket(socket: WebSocket) {
      if (stopping || wss.clients.size >= 32) {
        socket.close(1013, "Gateway busy");
        return;
      }
      wss.clients.add(socket);
      socket.once("close", () => wss.clients.delete(socket));
      wss.emit("connection", socket);
    },
    async close() {
      stopping = true;
      clearInterval(timer);
      for (const ws of wss.clients) ws.close(1012, "Gateway restarting");
      while ([...rooms.values()].some((r) => r.busy || r.commitBusy))
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
