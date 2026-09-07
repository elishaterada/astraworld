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
it("M2 atomic contention, receipt replay, checkpoint recovery and starter grant identity", async () => {
  const redis = spawn(
    "redis-server",
    [
      "--bind",
      "127.0.0.1",
      "--port",
      "6397",
      "--save",
      "",
      "--appendonly",
      "no",
    ],
    { stdio: "ignore" },
  );
  const store = new Store(
    "redis://127.0.0.1:6397",
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
      redisUrl: "redis://127.0.0.1:6397",
      prefix: store.prefix,
      origins: ["http://test"],
    };
    a = await createRealtimeGateway({ ...options, owner: "a" });
    b = await createRealtimeGateway({ ...options, owner: "b" });
    await new Promise<void>((r) => a!.server.listen(3197, "127.0.0.1", r));
    await new Promise<void>((r) => b!.server.listen(3198, "127.0.0.1", r));
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
          protocolVersion: 2,
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
              protocolVersion: 2,
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
    const c1 = await client(3197, first),
      c2 = await client(3198, second);
    await until(() => c2.snapshots.at(-1)!.actors.length === 2);
    const target = `resource:meadow-2:${CONTENT_VERSION}:${first.seed}:65:63`;
    c1.gather(target);
    c2.gather(target);
    await until(
      () =>
        !!c1.snapshots.at(-1)?.progress?.receipt &&
        !!c2.snapshots.at(-1)?.progress?.receipt,
    );
    const results = [
      c1.snapshots.at(-1)!.progress!,
      c2.snapshots.at(-1)!.progress!,
    ];
    expect(results.map((p) => p.receipt!.result).sort()).toEqual([
      "depleted",
      "gathered",
    ]);
    expect(
      results
        .flatMap((p) => p.inventory)
        .filter((s) => s?.item === "sweet-berry")
        .reduce((n, s) => n + s!.quantity, 0),
    ).toBe(3);
    const winner = results[0].receipt!.result === "gathered" ? first : second;
    const checkpoint = await store.redis.get(
      store.key(first.worldId, "checkpoint"),
    );
    const committed = JSON.parse(checkpoint!);
    expect(committed.gathering.depleted).toEqual([target]);
    expect(committed.gathering.players[winner.playerId].receipt.result).toBe(
      "gathered",
    );
    await sleep(300); // Both clients continuously retry the identical command.
    expect(c1.snapshots.at(-1)!.progress).toEqual(results[0]);
    expect(c2.snapshots.at(-1)!.progress).toEqual(results[1]);
    const epoch = c2.snapshots.at(-1)!.epoch;
    await store.redis.set(store.key(first.worldId, "lease"), "foreign:999", {
      PX: 250,
    });
    await until(() => c2.snapshots.at(-1)!.epoch > epoch, 3500);
    const replacement = await client(3198, winner);
    replacement.gather(target);
    await until(
      () =>
        replacement.snapshots.at(-1)?.progress?.receipt?.result === "gathered",
    );
    const restored = replacement.snapshots.at(-1)!.progress!;
    expect(
      restored.inventory.filter((s) => s?.item === "hatchet"),
    ).toHaveLength(1);
    expect(
      restored.inventory.find((s) => s?.item === "sweet-berry")?.quantity,
    ).toBe(3);
    replacement.gather("conflicting-target");
    await sleep(200);
    expect(replacement.snapshots.at(-1)!.progress).toEqual(restored);
    const beforePause = replacement.snapshots.at(-1)!;
    await store.redis.sendCommand(["CLIENT", "PAUSE", "2200", "ALL"]);
    replacement.gather(target, 2);
    await sleep(1900);
    expect(replacement.snapshots.at(-1)!.progress).toEqual(restored);
    await until(
      () => replacement.snapshots.at(-1)?.progress?.receipt?.seq === 2,
      5000,
    );
    expect(replacement.snapshots.at(-1)!.progress!.receipt!.result).toBe(
      "depleted",
    );
    expect(replacement.snapshots.at(-1)!.progress!.inventory).toEqual(
      restored.inventory,
    );
    expect(replacement.snapshots.at(-1)!.epoch).toBeGreaterThan(
      beforePause.epoch,
    );
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
