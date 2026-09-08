import { it, expect } from "vitest";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { createRealtimeGateway } from "../apps/game-server/realtime";
import { Store } from "../apps/game-server/store";
import { CONTENT_VERSION, GENERATION_VERSION } from "../packages/world";
import type { Session } from "../packages/protocol";
import {
  packFrames,
  realtimeSnapshotSchema,
  type Frame,
  type RealtimeSnapshot,
} from "../packages/protocol/realtime";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(f: () => boolean, ms = 5000) {
  const end = Date.now() + ms;
  while (!f()) {
    if (Date.now() > end) throw Error("Timed out");
    await sleep(20);
  }
}
it("two independent gateways: exact acknowledgements, actions, generation fencing and owner recovery", async () => {
  const redis = spawn(
    "redis-server",
    [
      "--bind",
      "127.0.0.1",
      "--port",
      "6395",
      "--save",
      "",
      "--appendonly",
      "no",
    ],
    { stdio: "ignore" },
  );
  const store = new Store(
    "redis://127.0.0.1:6395",
    `test:${randomUUID()}`,
    1800,
  );
  const connections: {
    ws: WebSocket;
    timer: ReturnType<typeof setInterval>;
  }[] = [];
  let a: Awaited<ReturnType<typeof createRealtimeGateway>> | undefined,
    b: typeof a;
  try {
    await store.connect();
    const options = {
      redisUrl: "redis://127.0.0.1:6395",
      prefix: store.prefix,
      origins: ["http://test"],
    };
    a = await createRealtimeGateway({ ...options, owner: "a" });
    b = await createRealtimeGateway({ ...options, owner: "b" });
    await new Promise<void>((r) => a!.server.listen(3195, "127.0.0.1", r));
    await new Promise<void>((r) => b!.server.listen(3196, "127.0.0.1", r));
    const first = await store.create("Rowan", "ember"),
      second = await store.join("Mika", first.invite, "iris");
    async function client(port: number, s: Session) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/play`, {
        origin: "http://test",
      });
      let generation = 0;
      const snapshots: RealtimeSnapshot[] = [];
      let frames: Frame[] = [];
      ws.on("message", (raw) => {
        const d = JSON.parse(raw.toString());
        if (d.type === "connected") generation = d.generation;
        if (d.type === "snapshot") {
          const snap = realtimeSnapshotSchema.parse(d);
          snapshots.push(snap);
          const ack = snap.actors.find((a) => a.id === s.playerId)!.ack;
          frames = frames.filter((f) => f.seq > ack);
        }
      });
      await new Promise<void>((r) => ws.once("open", r));
      ws.send(
        JSON.stringify({
          type: "hello",
          protocolVersion: 6,
          worldId: s.worldId,
          token: s.token,
          contentVersion: CONTENT_VERSION,
          generationVersion: GENERATION_VERSION,
        }),
      );
      await until(() => generation > 0);
      const timer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(
            JSON.stringify({
              type: "frames",
              protocolVersion: 6,
              worldId: s.worldId,
              generation,
              runs: packFrames(frames),
            }),
          );
      }, 50);
      connections.push({ ws, timer });
      await until(() => snapshots.length > 0);
      return {
        ws,
        snapshots,
        get generation() {
          return generation;
        },
        enqueue: (f: Frame[]) => {
          frames.push(...f);
        },
      };
    }
    const c1 = await client(3195, first),
      c2 = await client(3196, second);
    await until(() => c2.snapshots.at(-1)!.actors.length === 2);
    const start = c1.snapshots
      .at(-1)!
      .actors.find((a) => a.id === first.playerId)!.position;
    c1.enqueue(
      Array.from({ length: 30 }, (_, i) => ({
        seq: i + 1,
        keys: i < 15 ? 8 : 0,
        facing: i < 15 ? 0 : 6,
        ...(i === 29 ? { wave: true as const } : {}),
      })),
    );
    await until(
      () =>
        c2.snapshots.at(-1)?.actors.find((a) => a.id === first.playerId)
          ?.ack === 30,
    );
    const peer = c2.snapshots
      .at(-1)!
      .actors.find((a) => a.id === first.playerId)!;
    expect(peer.position.x).toBeCloseTo(start.x + 1);
    expect(peer.facing).toBe(6);
    expect(peer.moving).toBe(false);
    expect(peer.action?.seq).toBe(30);
    expect(peer.character).toBe("ember");
    const oldClosed = new Promise<number>((r) =>
      c1.ws.once("close", (code) => r(code)),
    );
    const replacement = await client(3196, first);
    expect(replacement.generation).toBeGreaterThan(c1.generation);
    expect(await oldClosed).toBe(4001);
    await until(
      () =>
        c2.snapshots.at(-1)!.actors.find((a) => a.id === first.playerId)!
          .generation === replacement.generation,
    );
    const initial = c2.snapshots.at(-1)!;
    const owner = initial.owner;
    // Simulate an owner losing its lease: an old process must never overwrite the new owner.
    await store.redis.set(store.key(first.worldId, "lease"), "foreign:999", {
      PX: 250,
    });
    await until(() => c2.snapshots.at(-1)!.epoch > initial.epoch, 3500);
    expect(
      c2.snapshots.at(-1)!.actors.find((a) => a.id === first.playerId)!
        .position,
    ).toEqual(peer.position);
    await until(() => c2.snapshots.at(-1)!.tick > initial.tick);
    expect(owner).toBeTruthy();
    replacement.enqueue([{ seq: 1, keys: 0, facing: 4, wave: true }]);
    await until(
      () =>
        c2.snapshots.at(-1)!.actors.find((a) => a.id === first.playerId)!.action
          ?.generation === replacement.generation,
    );
    expect(
      c2.snapshots.at(-1)!.actors.find((a) => a.id === first.playerId)!.facing,
    ).toBe(4);
    const beforePause = c2.snapshots.at(-1)!;
    await store.redis.sendCommand(["CLIENT", "PAUSE", "2200", "ALL"]);
    replacement.enqueue([{ seq: 2, keys: 0, facing: 6 }]);
    await sleep(1900);
    expect(c2.snapshots.at(-1)!.tick).toBe(beforePause.tick);
    await until(
      () =>
        c2.snapshots.at(-1)!.actors.find((a) => a.id === first.playerId)!
          .ack === 2,
      5000,
    );
    expect(c2.snapshots.at(-1)!.epoch).toBeGreaterThan(beforePause.epoch);
    expect(
      c2.snapshots.at(-1)!.actors.find((a) => a.id === first.playerId)!.facing,
    ).toBe(6);
  } finally {
    for (const c of connections) {
      clearInterval(c.timer);
      c.ws.close();
    }
    await a?.close();
    await b?.close();
    await store.close();
    redis.kill("SIGTERM");
  }
}, 15000);
