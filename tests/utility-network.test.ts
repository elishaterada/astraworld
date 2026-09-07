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
it("M5 utility survives owner turnover, retries, replacement generation and late join", async () => {
  const redis = spawn(
    "redis-server",
    [
      "--bind",
      "127.0.0.1",
      "--port",
      "6401",
      "--save",
      "",
      "--appendonly",
      "no",
    ],
    { stdio: "ignore" },
  );
  const store = new Store(
    "redis://127.0.0.1:6401",
    `test:${randomUUID()}`,
    1800,
    8,
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
      redisUrl: "redis://127.0.0.1:6401",
      prefix: store.prefix,
      origins: ["http://test"],
    };
    a = await createRealtimeGateway({ ...options, owner: "a" });
    b = await createRealtimeGateway({ ...options, owner: "b" });
    await new Promise<void>((r) => a!.server.listen(3211, "127.0.0.1", r));
    await new Promise<void>((r) => b!.server.listen(3212, "127.0.0.1", r));
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
      let companion:
        | import("../packages/protocol/taming").CompanionCommand
        | undefined;
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
              ...(companion ? { companion } : {}),
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
        companion: (
          target: string,
          seq: number,
          action: "feed" | "stay" | "follow" | "dissolve" = "feed",
        ) => {
          companion = { target, seq, action };
        },
        enqueue: (f: Frame[]) => {
          frames.push(...f);
        },
      };
    }
    const c1 = await client(3211, first),
      c2 = await client(3212, second);
    const last = (c: typeof c1) => c.snapshots.at(-1)!;
    c1.gather(
      `resource:${GENERATION_VERSION}:${CONTENT_VERSION}:${first.seed}:65:63`,
    );
    await until(() => last(c1).progress?.receipt?.result === "gathered");
    c1.enqueue(
      Array.from({ length: 30 }, (_, i) => ({
        seq: i + 1,
        keys: 4,
        facing: 4,
      })),
    );
    c2.enqueue(
      Array.from({ length: 60 }, (_, i) => ({
        seq: i + 1,
        keys: 4,
        facing: 4,
      })),
    );
    await until(
      () => last(c2).actors.find((a) => a.id === second.playerId)!.ack === 60,
    );
    c2.gather(
      `resource:${GENERATION_VERSION}:${CONTENT_VERSION}:${first.seed}:63:65`,
    );
    await until(() => last(c2).progress?.receipt?.result === "gathered");
    const target = last(c1).moss![0].id;
    c1.companion(target, 1);
    await until(() => last(c1).companionReceipt?.result === "fed");
    c2.companion(target, 1);
    await until(() => last(c2).companionReceipt?.result === "claimed");
    expect(
      last(c2).progress!.inventory.find((s) => s?.item === "sweet-berry")!
        .quantity,
    ).toBe(3);
    const epoch = last(c1).epoch;
    await store.redis.set(store.key(first.worldId, "lease"), "foreign:999", {
      PX: 250,
    });
    await until(() => last(c2).epoch > epoch, 4000);
    expect(last(c2).moss![0].feeds).toBe(1);
    const replacement = await client(3212, first);
    replacement.companion(target, 1);
    await sleep(300);
    expect(
      last(replacement).progress!.inventory.find(
        (s) => s?.item === "sweet-berry",
      )!.quantity,
    ).toBe(2);
    await sleep(1100);
    replacement.companion(target, 2);
    await until(() => last(replacement).moss![0].feeds === 2);
    await sleep(1100);
    replacement.companion(target, 3);
    await until(() => last(replacement).moss![0].owner === first.playerId);
    c2.companion(target, 2);
    await until(() => last(c2).companionReceipt?.result === "owned");
    expect(
      last(replacement).progress!.inventory.some(
        (s) => s?.item === "sweet-berry",
      ),
    ).toBe(false);
    replacement.companion(target, 4, "stay");
    await until(() => last(c2).moss![0].mode === "stay");
    const oldEpoch = last(c2).epoch;
    await store.redis.set(store.key(first.worldId, "lease"), "foreign:1000", {
      PX: 250,
    });
    await until(() => last(c2).epoch > oldEpoch, 4000);
    expect(
      last(c2).moss!.filter((m) => m.owner === first.playerId),
    ).toHaveLength(1);
    expect(last(c2).moss).toHaveLength(2);
    expect(last(c2).moss![0].mode).toBe("stay");
    c2.companion(target, 3, "stay");
    await until(() => last(c2).companionReceipt?.result === "forbidden");
    await sleep(600);
    replacement.companion(target, 5, "follow");
    await until(() => last(replacement).moss![0].mode === "follow");
    let sequence = 0;
    async function move(keys: number, count: number) {
      while (count > 0) {
        const n = Math.min(60, count);
        replacement.enqueue(
          Array.from({ length: n }, () => ({
            seq: ++sequence,
            keys,
            facing: 6,
          })),
        );
        await until(
          () =>
            last(replacement).actors.find((a) => a.id === first.playerId)!
              .ack === sequence,
        );
        count -= n;
      }
    }
    await move(8, 30);
    await move(1, 375);
    await until(
      () =>
        Math.hypot(
          last(replacement).moss![0].position.x - 64.5,
          last(replacement).moss![0].position.y - 39.3,
        ) < 2,
    );
    const gate = last(replacement).gate!;
    replacement.companion(gate.id, 6, "dissolve");
    await until(() => !!last(c2).gate?.channel);
    const channelEpoch = last(c2).epoch;
    await store.redis.set(store.key(first.worldId, "lease"), "foreign:1001", {
      PX: 250,
    });
    await until(() => last(c2).epoch > channelEpoch, 4000);
    await until(() => last(c2).gate!.open, 5000);
    const openedTick = last(c2).gate!.openedTick;
    const resumed = await client(3211, first);
    resumed.companion(gate.id, 6, "dissolve");
    await sleep(300);
    expect(last(resumed).gate!.openedTick).toBe(openedTick);
    const newcomer = await store.join("Hazel", first.invite, "hazel");
    const c3 = await client(3212, newcomer);
    expect(last(c3).gate!.open).toBe(true);
    expect(last(c3).gate!.openedTick).toBe(openedTick);
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
}, 40000);
