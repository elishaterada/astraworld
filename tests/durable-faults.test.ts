import { it, expect } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { Store } from "../apps/game-server/store";
import { DurableStore } from "../apps/game-server/durable";
import { CONTENT_VERSION, GENERATION_VERSION } from "../packages/world";
import {
  realtimeSnapshotSchema,
  type RealtimeSnapshot,
} from "../packages/protocol/realtime";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(f: () => boolean, ms = 12000) {
  const end = Date.now() + ms;
  while (!f()) {
    if (Date.now() > end) throw Error("Timed out");
    await sleep(25);
  }
}
it.skipIf(!process.env.TEST_DATABASE_URL)(
  "M6 TCP database outage never acknowledges a reward; SIGKILL plus Redis loss preserves the eventual commit",
  async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (url.hostname !== "127.0.0.1")
      throw Error("Fault test requires disposable loopback Postgres");
    const sockets = new Set<net.Socket>();
    let blocked = false;
    const proxy = net.createServer((front) => {
      if (blocked) {
        front.destroy();
        return;
      }
      const back = net.connect(Number(url.port || 5432), url.hostname);
      for (const s of [front, back]) {
        sockets.add(s);
        s.on("error", () => {});
        s.on("close", () => sockets.delete(s));
      }
      front.pipe(back);
      back.pipe(front);
      front.on("close", () => back.destroy());
      back.on("close", () => front.destroy());
    });
    await new Promise<void>((r) => proxy.listen(55434, "127.0.0.1", r));
    const redis = spawn(
      "redis-server",
      [
        "--bind",
        "127.0.0.1",
        "--port",
        "6403",
        "--save",
        "",
        "--appendonly",
        "no",
      ],
      { stdio: "ignore" },
    );
    const prefix = `test:${randomUUID()}`,
      store = new Store(
        "redis://127.0.0.1:6403",
        prefix,
        1800,
        8,
        new DurableStore(process.env.TEST_DATABASE_URL!, prefix),
      );
    const proxyUrl = new URL(url);
    proxyUrl.port = "55434";
    let child: ChildProcess | undefined;
    const clients: { ws: WebSocket; timer: ReturnType<typeof setInterval> }[] =
      [];
    async function start() {
      child = spawn(
        process.execPath,
        ["--import", "tsx", "apps/game-server/main-realtime.ts"],
        {
          env: {
            ...process.env,
            DATABASE_URL: proxyUrl.href,
            REDIS_URL: "redis://127.0.0.1:6403",
            GAME_NAMESPACE: prefix,
            WEB_ORIGINS: "http://test",
            GAME_PORT: "3231",
          },
          stdio: "ignore",
        },
      );
      let ready = false;
      for (let i = 0; i < 100 && !ready; i++) {
        try {
          ready = (await fetch("http://127.0.0.1:3231/health")).ok;
        } catch {}
        if (!ready) await sleep(50);
      }
      expect(ready).toBe(true);
    }
    async function kill() {
      if (!child) return;
      const exit = new Promise((r) => child!.once("exit", r));
      child.kill("SIGKILL");
      await exit;
      child = undefined;
    }
    try {
      await store.connect();
      await start();
      const session = await store.create("Rowan", "iris");
      async function connect() {
        const ws = new WebSocket("ws://127.0.0.1:3231/play", {
          origin: "http://test",
        });
        ws.on("error", () => {});
        let generation = 0,
          command = false;
        const snapshots: RealtimeSnapshot[] = [];
        ws.on("message", (raw) => {
          const d = JSON.parse(raw.toString());
          if (d.type === "connected") generation = d.generation;
          if (d.type === "snapshot")
            snapshots.push(realtimeSnapshotSchema.parse(d));
        });
        await new Promise<void>((r) => ws.once("open", r));
        ws.send(
          JSON.stringify({
            type: "hello",
            protocolVersion: 3,
            worldId: session.worldId,
            token: session.token,
            contentVersion: CONTENT_VERSION,
            generationVersion: GENERATION_VERSION,
          }),
        );
        const timer = setInterval(() => {
          if (generation && ws.readyState === WebSocket.OPEN)
            ws.send(
              JSON.stringify({
                type: "frames",
                protocolVersion: 3,
                worldId: session.worldId,
                generation,
                runs: [],
                ...(command
                  ? {
                      gather: {
                        seq: 1,
                        target: `resource:${GENERATION_VERSION}:${CONTENT_VERSION}:${session.seed}:65:63`,
                      },
                    }
                  : {}),
              }),
            );
        }, 50);
        clients.push({ ws, timer });
        await until(() => snapshots.length > 0);
        return {
          snapshots,
          gather() {
            command = true;
          },
        };
      }
      const first = await connect();
      blocked = true;
      for (const s of sockets) s.destroy();
      first.gather();
      await sleep(1200);
      expect(
        first.snapshots.some((s) => s.progress?.receipt?.result === "gathered"),
      ).toBe(false);
      expect(
        (await store.durable!.load(session.worldId))!.state!.gathering.players[
          session.playerId
        ].receipt,
      ).toBeNull();
      blocked = false;
      await until(
        () => first.snapshots.at(-1)?.progress?.receipt?.result === "gathered",
        20000,
      );
      const inventory = first.snapshots.at(-1)!.progress!.inventory;
      expect(
        (await store.durable!.load(session.worldId))!.state!.gathering.players[
          session.playerId
        ].inventory,
      ).toEqual(inventory);
      await kill();
      await store.redis.flushDb();
      await start();
      const recovered = await connect();
      expect(recovered.snapshots.at(-1)!.progress!.inventory).toEqual(
        inventory,
      );
      recovered.gather();
      await sleep(400);
      expect(recovered.snapshots.at(-1)!.progress!.inventory).toEqual(
        inventory,
      );
    } finally {
      for (const c of clients) {
        clearInterval(c.timer);
        c.ws.terminate();
      }
      await kill();
      await store.close();
      redis.kill();
      for (const s of sockets) s.destroy();
      await new Promise<void>((r) => proxy.close(() => r()));
    }
  },
  45000,
);
