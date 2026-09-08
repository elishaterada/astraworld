import { it, expect } from "vitest";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRealtimeGateway } from "../apps/game-server/realtime";
import { MAX_PLAYERS } from "../packages/protocol/capacity";
import { realtimeSnapshotSchema } from "../packages/protocol/realtime";
import { generateWorld, SPAWN } from "../packages/world";
import { collides } from "../packages/simulation";

it("admits exactly eight members under concurrent cross-gateway joins and preserves their resume credentials", async () => {
  const redis = spawn(
    "redis-server",
    [
      "--bind",
      "127.0.0.1",
      "--port",
      "6396",
      "--save",
      "",
      "--appendonly",
      "no",
    ],
    { stdio: "ignore" },
  );
  let a: Awaited<ReturnType<typeof createRealtimeGateway>> | undefined,
    b: typeof a;
  try {
    const options = {
      redisUrl: "redis://127.0.0.1:6396",
      prefix: `test:${randomUUID()}`,
      origins: ["http://test"],
    };
    a = await createRealtimeGateway(options);
    b = await createRealtimeGateway(options);
    const host = await a.store.create("Host");
    const outcomes = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        (i % 2 ? a! : b!).store.join(`Friend ${i}`, host.invite),
      ),
    );
    const joined = outcomes
      .filter((o) => o.status === "fulfilled")
      .map((o) => o.value);
    expect(joined).toHaveLength(7);
    expect(outcomes.filter((o) => o.status === "rejected")).toHaveLength(13);
    const members = (await a.store.read(host.worldId)).members;
    expect(members).toHaveLength(MAX_PLAYERS);
    expect(members.map((m) => m.spawnIndex).sort((a, b) => a! - b!)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
    for (const session of [host, ...joined])
      expect(await b.store.authenticate(host.worldId, session.token)).toBe(
        session.playerId,
      );
    await expect(a.store.join("Ninth", host.invite)).rejects.toThrow(
      "8 adventurers",
    );
    expect(a.store.maxPlayers).toBe(8);
    expect(b.store.maxPlayers).toBe(8);
  } finally {
    await a?.close();
    await b?.close();
    redis.kill("SIGTERM");
  }
}, 10000);

it("accepts all eight actors, rejects a ninth snapshot actor, and provides collision-free eight-player spawns", () => {
  const world = generateWorld("meadow-001");
  const actors = Array.from({ length: 8 }, (_, i) => ({
    id: randomUUID(),
    name: `Friend ${i}`,
    character: "fern",
    position: { x: SPAWN.x + 2 * i, y: SPAWN.y },
    generation: 1,
    ack: 0,
    facing: 2,
    moving: false,
    action: null,
  }));
  const snapshot = {
    type: "snapshot",
    protocolVersion: 6,
    worldId: randomUUID(),
    seed: world.seed,
    epoch: 1,
    tick: 1,
    owner: "test",
    selfId: actors[0].id,
    actors,
  };
  expect(realtimeSnapshotSchema.safeParse(snapshot).success).toBe(true);
  expect(
    realtimeSnapshotSchema.safeParse({
      ...snapshot,
      actors: [...actors, { ...actors[0], id: randomUUID() }],
    }).success,
  ).toBe(false);
  for (const actor of actors)
    expect(collides(world, actor.position)).toBe(false);
});
