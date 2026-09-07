import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { Store } from "../apps/game-server/store";
import { createGateway } from "../apps/game-server/server";
import {
  parseClient,
  joinSchema,
  actorSchema,
  VERSION,
  type Snapshot,
  type Session,
} from "../packages/protocol";
import { CONTENT_VERSION, GENERATION_VERSION } from "../packages/world";
const evidence: Record<string, unknown> = {};
const origin = "http://127.0.0.1:3002";
const url = "redis://127.0.0.1:6391",
  prefix = `test:${randomUUID()}`;
let redis: ChildProcess,
  store: Store,
  a: Awaited<ReturnType<typeof createGateway>>,
  b: typeof a;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(check: () => boolean, ms = 5000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw Error("Timed out");
    await sleep(25);
  }
}
async function client(port: number, s: Session, characters = false) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/play`, { origin });
  let generation = 0;
  const snapshots: Snapshot[] = [];
  ws.on("message", (raw) => {
    const v = JSON.parse(raw.toString());
    if (v.type === "connected") generation = v.generation;
    if (v.type === "snapshot") snapshots.push(v);
  });
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  ws.send(
    JSON.stringify({
      type: "hello",
      ...(characters ? { characters: true } : {}),
      protocolVersion: VERSION,
      worldId: s.worldId,
      token: s.token,
      contentVersion: CONTENT_VERSION,
      generationVersion: GENERATION_VERSION,
    }),
  );
  await until(() => generation > 0);
  let seq = 0;
  const input = (x: number, y: number) =>
    ws.send(
      JSON.stringify({
        type: "input",
        protocolVersion: VERSION,
        worldId: s.worldId,
        generation,
        seq: ++seq,
        movement: { x, y },
      }),
    );
  return {
    ws,
    snapshots,
    input,
    get generation() {
      return generation;
    },
  };
}
beforeAll(async () => {
  redis = spawn(
    "redis-server",
    [
      "--bind",
      "127.0.0.1",
      "--port",
      "6391",
      "--save",
      "",
      "--appendonly",
      "no",
    ],
    { stdio: "ignore" },
  );
  await sleep(250);
  store = new Store(url, prefix);
  await store.connect();
  a = await createGateway({
    redisUrl: url,
    prefix,
    origins: [origin],
    owner: "A",
  });
  b = await createGateway({
    redisUrl: url,
    prefix,
    origins: [origin],
    owner: "B",
  });
  await Promise.all([
    new Promise<void>((r) => a.server.listen(3191, "127.0.0.1", r)),
    new Promise<void>((r) => b.server.listen(3192, "127.0.0.1", r)),
  ]);
});
afterAll(async () => {
  writeFileSync(
    "docs/milestones/evidence/m1-integration.json",
    JSON.stringify(
      {
        node: process.version,
        ...evidence,
        gatewayA: {
          ticks: a?.metrics.ticks,
          rejected: a?.metrics.rejected,
          fenced: a?.metrics.fenced,
        },
        gatewayB: {
          ticks: b?.metrics.ticks,
          rejected: b?.metrics.rejected,
          fenced: b?.metrics.fenced,
        },
      },
      null,
      2,
    ),
  );
  await Promise.all([a?.close(), b?.close(), store?.close()]);
  redis?.kill();
});
describe("M1 real Redis and WebSocket authority", () => {
  it("validates character choices and preserves cosmetics across gateways and reconnect", async () => {
    expect(
      joinSchema.safeParse({ name: "Rowan", character: "invented" }).success,
    ).toBe(false);
    expect(joinSchema.parse({ name: "Legacy" }).character).toBe("fern");
    const response = await fetch("http://127.0.0.1:3191/session", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Invalid", character: "invented" }),
    });
    expect(response.status).toBe(400);
    const s = await store.create("Rowan", "ember");
    const friend = await store.join("Mika", s.invite, "iris");
    const c = await client(3191, s, true),
      d = await client(3192, friend);
    try {
      await until(
        () =>
          c.snapshots.at(-1)?.actors.length === 2 &&
          d.snapshots.at(-1)?.actors.length === 2,
      );
      expect(
        c.snapshots.at(-1)!.actors.find((a) => a.id === friend.playerId)
          ?.character,
      ).toBe("iris");
      // Old clients receive their original strict schema, even from a new owner.
      for (const actor of d.snapshots.at(-1)!.actors) {
        expect(actor).not.toHaveProperty("character");
        expect(
          actorSchema.omit({ character: true }).strict().safeParse(actor)
            .success,
        ).toBe(true);
      }
      c.ws.close();
      const resumed = await client(3192, s, true);
      try {
        await until(() => resumed.snapshots.length > 0);
        expect(
          resumed.snapshots.at(-1)!.actors.find((a) => a.id === s.playerId)
            ?.character,
        ).toBe("ember");
      } finally {
        resumed.ws.close();
      }
      // Hot records made before the selector get the default without losing identity.
      const key = store.key(s.worldId, "members");
      const member = JSON.parse(
        (await store.redis.hGet(key, friend.playerId))!,
      );
      delete member.character;
      await store.redis.hSet(key, friend.playerId, JSON.stringify(member));
      expect(
        (await store.read(s.worldId)).members.find(
          (m) => m.id === friend.playerId,
        )?.character,
      ).toBe("fern");
    } finally {
      c.ws.close();
      d.ws.close();
    }
  });

  it("rejects authoritative fields, wrong versions, nonfinite vectors and oversized frames", () => {
    const base = {
      protocolVersion: 1,
      type: "input",
      worldId: randomUUID(),
      generation: 1,
      seq: 1,
      movement: { x: 1, y: 1 },
    };
    expect(parseClient(JSON.stringify(base))).not.toBeNull();
    for (const change of [
      { position: { x: 0, y: 0 } },
      { speed: 100 },
      { protocolVersion: 2 },
      { movement: { x: 2, y: 0 } },
      { movement: { x: NaN, y: 0 } },
      { seq: -1 },
    ])
      expect(parseClient(JSON.stringify({ ...base, ...change }))).toBeNull();
    expect(parseClient(" ".repeat(8193))).toBeNull();
  });
  it("admits exactly one invited friend under contention and fences stale owners/connections", async () => {
    const s = await store.create("Rowan");
    const joins = await Promise.allSettled([
      store.join("Mika", s.invite),
      store.join("Alex", s.invite),
    ]);
    expect(joins.filter((j) => j.status === "fulfilled")).toHaveLength(1);
    expect(await store.authenticate(s.worldId, "x".repeat(43))).toBeNull();
    const epochs = await Promise.all([
      store.acquire(s.worldId, "first"),
      store.acquire(s.worldId, "second"),
    ]);
    expect(epochs.filter(Boolean)).toHaveLength(1);
    const token = `${epochs[0] ? "first" : "second"}:1`;
    expect(
      await store.commit(s.worldId, token, { tick: 1, actors: [] }, null),
    ).toBe(true);
    await store.redis.pExpire(store.key(s.worldId, "lease"), 1);
    await sleep(10);
    expect(await store.acquire(s.worldId, "replacement")).toBe(2);
    expect(
      await store.commit(s.worldId, token, { tick: 999, actors: [] }, null),
    ).toBe(false);
    expect((await store.read(s.worldId)).checkpoint?.tick).toBe(1);
    const g1 = await store.attach(s.worldId, s.playerId),
      g2 = await store.attach(s.worldId, s.playerId);
    expect(await store.input(s.worldId, s.playerId, g1, 100, 1, 0)).toBe(false);
    expect(await store.input(s.worldId, s.playerId, g2, 1, 0, 1)).toBe(true);
    expect(await store.input(s.worldId, s.playerId, g2, 1, 1, 0)).toBe(false);
  });
  it("two gateways share motion, stop stale input, reject forgery and replace a resumed session", async () => {
    const s = await store.create("Rowan"),
      friend = await store.join("Mika", s.invite);
    const c = await client(3191, s),
      d = await client(3192, friend);
    const heart = setInterval(() => {
      if (d.ws.readyState === 1) d.input(0, 0);
    }, 100);
    try {
      await until(
        () =>
          c.snapshots.some((s) => s.actors.length === 2) &&
          d.snapshots.some((s) => s.actors.length === 2),
      );
      const start = c.snapshots
        .at(-1)!
        .actors.find((a) => a.id === s.playerId)!.position;
      c.input(1, 1);
      await sleep(700);
      const stopped = d.snapshots
        .at(-1)!
        .actors.find((a) => a.id === s.playerId)!.position;
      expect(
        Math.hypot(stopped.x - start.x, stopped.y - start.y),
      ).toBeLessThanOrEqual(1.21);
      await sleep(300);
      expect(
        d.snapshots.at(-1)!.actors.find((a) => a.id === s.playerId)!.position,
      ).toEqual(stopped);
      c.ws.send(
        JSON.stringify({
          type: "input",
          protocolVersion: 1,
          worldId: s.worldId,
          generation: c.generation,
          seq: 500,
          movement: { x: 1, y: 0 },
          position: { x: 10, y: 10 },
        }),
      );
      await until(() => c.ws.readyState === 3);
      const resumed = await client(3192, s);
      await until(() => resumed.snapshots.length > 0);
      expect(resumed.generation).toBeGreaterThan(c.generation);
      expect(resumed.snapshots.at(-1)!.selfId).toBe(s.playerId);
      expect(
        resumed.snapshots.at(-1)!.actors.find((a) => a.id === s.playerId)!
          .position,
      ).toEqual(stopped);
      let replacementCode = 0;
      resumed.ws.on("close", (code) => {
        replacementCode = code;
      });
      const duplicate = await client(3191, s);
      if (resumed.ws.readyState === 1) resumed.input(1, 0);
      await until(() => resumed.ws.readyState === 3);
      expect(replacementCode).toBe(4001);
      duplicate.ws.close();
      resumed.ws.close();
    } finally {
      clearInterval(heart);
      c.ws.close();
      d.ws.close();
    }
  });
  it("rejects an invented credential at the actual gateway", async () => {
    const s = await store.create("Access");
    const ws = new WebSocket("ws://127.0.0.1:3191/play", { origin });
    const closed = new Promise<number>((resolve) => ws.once("close", resolve));
    await new Promise<void>((resolve) => ws.once("open", resolve));
    ws.send(
      JSON.stringify({
        type: "hello",
        protocolVersion: VERSION,
        worldId: s.worldId,
        token: "x".repeat(43),
        contentVersion: CONTENT_VERSION,
        generationVersion: GENERATION_VERSION,
      }),
    );
    expect(await closed).toBe(4003);
  });
  it("coalesces bounded intents while the Redis adapter is slow", async () => {
    const session = await store.create("Latency");
    const c = await client(3191, session);
    await until(() => c.snapshots.length > 0);
    const original = a.store.input.bind(a.store);
    a.store.input = async (...args) => {
      await sleep(120);
      return original(...args);
    };
    try {
      for (let i = 0; i < 10; i++) {
        c.input(i === 9 ? 0 : 1, 0);
        await sleep(50);
      }
      await sleep(500);
      expect(c.ws.readyState).toBe(WebSocket.OPEN);
      const checkpoint = (await store.read(session.worldId)).checkpoint!;
      expect(
        checkpoint.actors.find((x) => x.id === session.playerId)!.ack,
      ).toBe(10);
    } finally {
      a.store.input = original;
      c.ws.close();
    }
  });
  it("pins room generation/content versions and rejects a mismatched room", async () => {
    const s = await store.create("Version");
    const meta = (await store.read(s.worldId)).meta!;
    expect(meta.contentVersion).toBe(CONTENT_VERSION);
    expect(meta.generationVersion).toBe(GENERATION_VERSION);
    await store.redis.set(
      store.key(s.worldId, "meta"),
      JSON.stringify({ ...meta, generationVersion: "future" }),
    );
    expect(await store.authenticate(s.worldId, s.token)).toBeNull();
    await expect(store.join("Friend", s.invite)).rejects.toThrow();
  });
  it("rate-limits input floods without accelerating movement", async () => {
    const s = await store.create("Flood");
    const c = await client(3191, s);
    await until(() => c.snapshots.length > 0);
    for (let i = 0; i < 100; i++) if (c.ws.readyState === 1) c.input(1, 0);
    await until(() => c.ws.readyState === 3);
    const state = await store.read(s.worldId);
    expect(
      (state.checkpoint?.actors[0].position.x ?? 64.5) - 64.5,
    ).toBeLessThanOrEqual(1.2);
  });
  it("pauses publication during Redis unavailability and resumes without catch-up movement", async () => {
    const s = await store.create("Outage");
    const c = await client(3192, s);
    await until(() => c.snapshots.length > 0);
    const heart = setInterval(() => {
      if (c.ws.readyState === 1) c.input(0, 0);
    }, 100);
    try {
      redis.kill("SIGSTOP");
      await sleep(300);
      const before = c.snapshots.length;
      await sleep(1200);
      expect(c.snapshots.length).toBe(before);
      redis.kill("SIGCONT");
      await sleep(500);
      const recovered = await client(3191, s);
      await until(() => recovered.snapshots.length > 0);
      expect(
        recovered.snapshots.at(-1)!.actors.find((a) => a.id === s.playerId)!
          .position,
      ).toEqual({ x: 64.5, y: 64.5 });
      recovered.ws.close();
    } finally {
      redis.kill("SIGCONT");
      clearInterval(heart);
      c.ws.close();
    }
  });
  it("recovers another owner within 15 seconds after a process dies", async () => {
    const crashPrefix = `test:${randomUUID()}`,
      sessions = new Store(url, crashPrefix);
    await sessions.connect();
    const args = {
      env: {
        ...process.env,
        REDIS_URL: url,
        GAME_NAMESPACE: crashPrefix,
        WEB_ORIGINS: origin,
      },
      stdio: "ignore" as const,
    };
    const left = spawn(
      process.execPath,
      ["--import", "tsx", "apps/game-server/main.ts"],
      {
        ...args,
        env: { ...args.env, GAME_PORT: "3193", GATEWAY_ID: "crash-A" },
      },
    );
    const right = spawn(
      process.execPath,
      ["--import", "tsx", "apps/game-server/main.ts"],
      {
        ...args,
        env: { ...args.env, GAME_PORT: "3194", GATEWAY_ID: "crash-B" },
      },
    );
    // Wait for actual readiness rather than racing a fixed process-start delay.
    try {
      await Promise.all(
        [3193, 3194].map(async (port) => {
          const deadline = Date.now() + 10000;
          while (true) {
            try {
              if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return;
            } catch {
              /* Starting. */
            }
            if (Date.now() > deadline)
              throw Error(`Gateway ${port} did not start`);
            await sleep(100);
          }
        }),
      );
    } catch (error) {
      left.kill();
      right.kill();
      await sessions.close();
      throw error;
    }
    const s = await sessions.create("Rowan"),
      f = await sessions.join("Mika", s.invite);
    const c = await client(3193, s),
      d = await client(3194, f);
    const heart = setInterval(() => {
      for (const p of [c, d]) if (p.ws.readyState === 1) p.input(0, 0);
    }, 100);
    try {
      await until(() => c.snapshots.length > 0 && d.snapshots.length > 0);
      const first = c.snapshots.at(-1)!,
        started = Date.now();
      (first.owner === "crash-A" ? left : right).kill("SIGKILL");
      const survivor = first.owner === "crash-A" ? d : c;
      await until(
        () => !!survivor.snapshots.find((s) => s.epoch > first.epoch),
        15000,
      );
      const recoveryMs = Date.now() - started;
      evidence.ownerCrash = {
        recoveryMs,
        oldOwner: first.owner,
        newOwner: survivor.snapshots.at(-1)!.owner,
        oldEpoch: first.epoch,
        newEpoch: survivor.snapshots.at(-1)!.epoch,
      };
      expect(recoveryMs).toBeLessThan(15000);
      expect(survivor.snapshots.at(-1)!.owner).not.toBe(first.owner);
      expect(
        await sessions.commit(
          s.worldId,
          `${first.owner}:${first.epoch}`,
          { tick: 999999, actors: [] },
          null,
        ),
      ).toBe(false);
    } finally {
      clearInterval(heart);
      c.ws.close();
      d.ws.close();
      left.kill();
      right.kill();
      await sessions.close();
    }
  }, 32000);
});
