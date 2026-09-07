import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { generateWorld, SPAWN } from "../packages/world";
import { freshTaming } from "../packages/simulation/taming";
import { teleportTo } from "../packages/simulation/travel";
import { applyFrame } from "../packages/simulation/realtime";
import { freshCombat } from "../packages/simulation/combat";
import { collides } from "../packages/simulation";
import type { RealtimeActor } from "../packages/protocol/realtime";
const world = generateWorld("meadow-001");
const actor = (x = 64.5, y = 64.5): RealtimeActor => ({
  id: randomUUID(),
  name: "Rowan",
  character: "fern",
  position: { x, y },
  generation: 1,
  ack: 0,
  facing: 0,
  moving: false,
  action: null,
  combat: freshCombat({ x, y }),
});
it("running is 1.75x walking with normalized diagonals and collision", () => {
  const a = actor(),
    walk = applyFrame(world, a, { seq: 1, keys: 8, facing: 0 }, 1),
    run = applyFrame(world, a, { seq: 1, keys: 24, facing: 0 }, 1),
    diag = applyFrame(world, a, { seq: 1, keys: 26, facing: 0 }, 1);
  expect(run.position.x - a.position.x).toBeCloseTo(
    (walk.position.x - a.position.x) * 1.75,
  );
  expect(
    Math.hypot(diag.position.x - a.position.x, diag.position.y - a.position.y),
  ).toBeCloseTo(run.position.x - a.position.x);
  let b = a;
  for (let i = 1; i < 1000; i++)
    b = applyFrame(world, b, { seq: i, keys: 24, facing: 0 }, i);
  expect(collides(world, b.position)).toBe(false);
});
it("teleport lands near a live same-world actor; duplicate and cooldown cannot move twice", () => {
  const a = actor(),
    b = actor(114.5),
    actors = [a, b],
    online = new Set(actors.map((a) => a.id)),
    command = { seq: 1, action: "teleport" as const, target: b.id };
  const first = teleportTo(
    world,
    freshTaming(world.seed),
    actors,
    a.id,
    command,
    online,
    1,
  );
  expect(first.taming.receipts[a.id].result).toBe("teleported");
  expect(collides(world, first.actors[0].position)).toBe(false);
  expect(
    Math.hypot(
      first.actors[0].position.x - b.position.x,
      first.actors[0].position.y - b.position.y,
    ),
  ).toBeLessThanOrEqual(1.6);
  expect(
    teleportTo(world, first.taming, first.actors, a.id, command, online, 2)
      .actors,
  ).toBe(first.actors);
  expect(
    teleportTo(
      world,
      first.taming,
      first.actors,
      a.id,
      { ...command, seq: 2 },
      online,
      2,
    ).taming.receipts[a.id].result,
  ).toBe("cooldown");
  expect(
    teleportTo(
      world,
      first.taming,
      first.actors,
      a.id,
      { ...command, seq: 2 },
      new Set([a.id]),
      200,
    ).taming.receipts[a.id].result,
  ).toBe("missing");
});
it("teleport cannot bypass a closed Forest gate or invent a target", () => {
  const a = actor(),
    b = actor(64.5, 34.5),
    actors = [a, b],
    online = new Set(actors.map((a) => a.id)),
    command = { seq: 1, action: "teleport" as const, target: b.id };
  expect(
    teleportTo(world, freshTaming(world.seed), actors, a.id, command, online, 1)
      .taming.receipts[a.id].result,
  ).toBe("blocked");
  expect(
    teleportTo(
      world,
      freshTaming(world.seed),
      actors,
      a.id,
      { ...command, target: randomUUID() },
      online,
      1,
    ).taming.receipts[a.id].result,
  ).toBe("missing");
});
