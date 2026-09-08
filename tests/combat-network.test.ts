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
it("M3 real gateways retain damage, hit receipts and defeat across ownership and session generations", async () => {
  const redis = spawn(
    "redis-server",
    [
      "--bind",
      "127.0.0.1",
      "--port",
      "6398",
      "--save",
      "",
      "--appendonly",
      "no",
    ],
    { stdio: "ignore" },
  );
  const store = new Store(
    "redis://127.0.0.1:6398",
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
      redisUrl: "redis://127.0.0.1:6398",
      prefix: store.prefix,
      origins: ["http://test"],
    };
    a = await createRealtimeGateway({ ...options, owner: "a" });
    b = await createRealtimeGateway({ ...options, owner: "b" });
    await new Promise<void>((r) => a!.server.listen(3199, "127.0.0.1", r));
    await new Promise<void>((r) => b!.server.listen(3200, "127.0.0.1", r));
    const first = await store.create("Rowan", "ember"),
      second = await store.join("Mika", first.invite, "iris");
    async function client(port: number, s: Session) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/play`, {
        origin: "http://test",
      });
      let generation = 0;
      const snapshots: RealtimeSnapshot[] = [];
      let frames: Frame[] = [];
      let command: { seq: number; target: string } | undefined;
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
              ...(command ? { gather: command } : {}),
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
        gather: (target: string, seq = 1) => {
          command = { seq, target };
        },
        enqueue: (f: Frame[]) => {
          frames.push(...f);
        },
      };
    }
    const c1 = await client(3199, first),
      c2 = await client(3200, second);
    const latest = () => c1.snapshots.at(-1)!;
    let seq = 0;
    for (let batch = 0; batch < 6; batch++) {
      c1.enqueue(
        Array.from({ length: 30 }, () => ({ seq: ++seq, keys: 1, facing: 6 })),
      );
      await until(
        () => latest().actors.find((a) => a.id === first.playerId)!.ack === seq,
      );
    }
    await until(
      () =>
        latest().actors.find((a) => a.id === first.playerId)!.combat!.health <
        100,
      6000,
    );
    const priorHealth = latest().actors.find((a) => a.id === first.playerId)!
      .combat!.health;
    c1.enqueue([{ seq: ++seq, keys: 0, facing: 6, attack: true }]);
    await until(() => latest().slime!.health === 20);
    const epoch = latest().epoch;
    await store.redis.set(store.key(first.worldId, "lease"), "foreign:999", {
      PX: 250,
    });
    await until(() => c2.snapshots.at(-1)!.epoch > epoch, 4000);
    expect(c2.snapshots.at(-1)!.slime!.health).toBe(20);
    const replacement = await client(3200, first);
    expect(
      replacement.snapshots.at(-1)!.actors.find((a) => a.id === first.playerId)!
        .combat!.health,
    ).toBeLessThanOrEqual(priorHealth);
    expect(replacement.snapshots.at(-1)!.progress!.inventory).toEqual(
      latest().progress!.inventory,
    );
    await sleep(650);
    replacement.enqueue([{ seq: 1, keys: 0, facing: 6, attack: true }]);
    await until(() => replacement.snapshots.at(-1)!.slime!.health === 10);
    await sleep(650);
    replacement.enqueue([{ seq: 2, keys: 0, facing: 6, attack: true }]);
    await until(() => replacement.snapshots.at(-1)!.slime!.health === 0);
    const death = replacement.snapshots.at(-1)!.slime!.deathTick;
    await until(() => c2.snapshots.at(-1)!.slime!.deathTick === death);
    await sleep(350);
    const checkpoint = JSON.parse(
      (await store.redis.get(store.key(first.worldId, "checkpoint")))!,
    );
    expect(checkpoint.slime.deathTick).toBe(death);
    const nextEpoch = replacement.snapshots.at(-1)!.epoch;
    await store.redis.set(store.key(first.worldId, "lease"), "foreign:1000", {
      PX: 250,
    });
    await until(() => replacement.snapshots.at(-1)!.epoch > nextEpoch, 4000);
    expect(replacement.snapshots.at(-1)!.slime!.deathTick).toBe(death);
    expect(replacement.snapshots.at(-1)!.progress!.inventory).toEqual(
      latest().progress!.inventory,
    );
  } finally {
    for (const c of connections) {
      clearInterval(c.timer);
      c.ws.terminate();
    }
    await a?.close();
    await b?.close();
    await store.close();
    redis.kill();
  }
}, 20000);
