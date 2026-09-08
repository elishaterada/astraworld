import { expect, it } from "vitest";
import { generateWorld, SIZE, isSolid } from "../packages/world";
import {
  freshTaming,
  commandCompanion,
  stepTaming,
  expireClaims,
  route,
} from "../packages/simulation/taming";
import { freshCombat } from "../packages/simulation/combat";
import { collides } from "../packages/simulation";
import { freshProgress } from "../packages/content";
import { emptyGathering } from "../packages/simulation/gathering";
import { companionCommandSchema } from "../packages/protocol/taming";
import type { RealtimeActor } from "../packages/protocol/realtime";
const world = generateWorld("meadow-001");
const actor = (id = "a"): RealtimeActor => ({
  id,
  name: id,
  character: "fern",
  position: { x: 62.5, y: 64.5 },
  generation: 1,
  ack: 0,
  facing: 4,
  moving: false,
  action: null,
  combat: freshCombat({ x: 64.5, y: 64.5 }),
});
function setup() {
  const gathering = emptyGathering();
  for (const id of ["a", "b"]) {
    gathering.players[id] = freshProgress();
    gathering.players[id].inventory[2] = { item: "sweet-berry", quantity: 6 };
  }
  return { taming: freshTaming(world.seed), gathering };
}
it("three serial feeds consume exactly three berries and preserve identity; duplicates and competing final feeds cannot steal", () => {
  let s = setup();
  const target = s.taming.creatures[0].id;
  s = commandCompanion(
    world,
    s.taming,
    s.gathering,
    actor(),
    { seq: 1, action: "feed", target },
    1,
  );
  const first = s;
  s = commandCompanion(
    world,
    s.taming,
    s.gathering,
    actor(),
    { seq: 1, action: "feed", target },
    2,
  );
  expect(s).toEqual(first);
  s = commandCompanion(
    world,
    s.taming,
    s.gathering,
    actor("b"),
    { seq: 1, action: "feed", target },
    61,
  );
  expect(s.taming.receipts.b.result).toBe("claimed");
  expect(s.gathering.players.b.inventory[2]!.quantity).toBe(6);
  s = commandCompanion(
    world,
    s.taming,
    s.gathering,
    actor(),
    { seq: 2, action: "feed", target },
    61,
  );
  s = commandCompanion(
    world,
    s.taming,
    s.gathering,
    actor(),
    { seq: 3, action: "feed", target },
    121,
  );
  expect(s.taming.creatures[0].owner).toBe("a");
  expect(s.taming.creatures).toHaveLength(8);
  expect(s.taming.creatures[0].id).toBe(target);
  expect(s.gathering.players.a.inventory[2]!.quantity).toBe(3);
  s = commandCompanion(
    world,
    s.taming,
    s.gathering,
    actor("b"),
    { seq: 2, action: "feed", target },
    121,
  );
  expect(s.taming.receipts.b.result).toBe("owned");
  s = commandCompanion(
    world,
    s.taming,
    s.gathering,
    actor(),
    { seq: 4, action: "feed", target: s.taming.creatures[1].id },
    181,
  );
  expect(s.taming.receipts.a.result).toBe("already-companion");
});
it("claim expires at its tick boundary, resets progress without a refund, and permits a new feeder", () => {
  let s = setup(),
    target = s.taming.creatures[0].id;
  s = commandCompanion(
    world,
    s.taming,
    s.gathering,
    actor(),
    { seq: 1, action: "feed", target },
    1,
  );
  expect(expireClaims(s.taming, 3600).creatures[0].feeds).toBe(1);
  s.taming = stepTaming(world, s.taming, [actor()], new Set(), 3601);
  expect(s.taming.creatures[0].claim).toBeNull();
  expect(s.taming.creatures[0].feeds).toBe(0);
  s = commandCompanion(
    world,
    s.taming,
    s.gathering,
    actor("b"),
    { seq: 1, action: "feed", target },
    3601,
  );
  expect(s.taming.creatures[0].claim!.player).toBe("b");
  expect(s.gathering.players.a.inventory[2]!.quantity).toBe(5);
});
it("invalid range, food, death, busy, cooldown, missing target, and owner commands do not consume food", () => {
  for (const kind of [
    "range",
    "food",
    "dead",
    "busy",
    "missing",
    "forbidden",
  ]) {
    let s = setup(),
      a = actor(),
      target = s.taming.creatures[0].id;
    if (kind === "range") a.position = { x: 80.5, y: 64.5 };
    if (kind === "food") s.gathering.players.a.inventory[2] = null;
    if (kind === "dead") a.combat!.health = 0;
    if (kind === "busy") a.combat!.attackReady = 500;
    if (kind === "missing") target = "forged";
    const inventory = structuredClone(s.gathering.players.a.inventory);
    s = commandCompanion(
      world,
      s.taming,
      s.gathering,
      a,
      { seq: 1, action: kind === "forbidden" ? "recall" : "feed", target },
      1,
    );
    expect(s.taming.receipts.a.result).toBe(kind);
    expect(s.gathering.players.a.inventory).toEqual(inventory);
  }
  let s = setup(),
    target = s.taming.creatures[0].id;
  s = commandCompanion(
    world,
    s.taming,
    s.gathering,
    actor(),
    { seq: 1, action: "feed", target },
    1,
  );
  s = commandCompanion(
    world,
    s.taming,
    s.gathering,
    actor(),
    { seq: 2, action: "feed", target },
    2,
  );
  expect(s.taming.receipts.a.result).toBe("cooldown");
  expect(s.gathering.players.a.inventory[2]!.quantity).toBe(5);
  expect(
    companionCommandSchema.safeParse({
      seq: 1,
      action: "feed",
      target,
      owner: "a",
      success: true,
    }).success,
  ).toBe(false);
});
it("follow collides, stay/disconnect stop movement, and safe recall avoids players", () => {
  let s = setup();
  s.taming.creatures[0] = {
    ...s.taming.creatures[0],
    owner: "a",
    feeds: 3,
    mode: "follow",
  };
  const a = actor();
  a.position = { x: 70.5, y: 64.5 };
  for (let tick = 1; tick <= 300; tick++) {
    s.taming = stepTaming(world, s.taming, [a], new Set(["a"]), tick);
    expect(collides(world, s.taming.creatures[0].position)).toBe(false);
  }
  expect(
    Math.hypot(
      s.taming.creatures[0].position.x - a.position.x,
      s.taming.creatures[0].position.y - a.position.y,
    ),
  ).toBeLessThan(2);
  s = commandCompanion(
    world,
    s.taming,
    s.gathering,
    a,
    { seq: 1, action: "stay", target: s.taming.creatures[0].id },
    301,
  );
  const stopped = s.taming.creatures[0].position;
  a.position = { x: 80.5, y: 64.5 };
  s.taming = stepTaming(world, s.taming, [a], new Set(["a"]), 400);
  expect(s.taming.creatures[0].position).toEqual(stopped);
  s = commandCompanion(
    world,
    s.taming,
    s.gathering,
    a,
    { seq: 2, action: "recall", target: s.taming.creatures[0].id },
    401,
  );
  a.position = { x: 90.5, y: 64.5 };
  s.taming = stepTaming(world, s.taming, [a], new Set(), 402);
  expect(s.taming.creatures[0].position).toEqual(stopped);
  s.taming = stepTaming(world, s.taming, [a], new Set(["a"]), 403);
  expect(collides(world, s.taming.creatures[0].position)).toBe(false);
  expect(
    Math.hypot(
      s.taming.creatures[0].position.x - a.position.x,
      s.taming.creatures[0].position.y - a.position.y,
    ),
  ).toBeGreaterThan(0.7);
  expect(
    Math.hypot(
      s.taming.creatures[0].position.x - a.position.x,
      s.taming.creatures[0].position.y - a.position.y,
    ),
  ).toBeLessThan(4);
});
it("pathfinding routes around obstacles and recall cannot cross a closed region boundary", () => {
  const w = generateWorld("path-test");
  // A complete solid column splits the otherwise reachable map, modeling a closed gate region.
  const divided = {
    ...w,
    tiles: w.tiles.map((t) =>
      t.x === 63 ? { ...t, blocker: "rock" as const } : t,
    ),
  };
  expect(
    route(divided, { x: 61.5, y: 64.5 }, { x: 65.5, y: 64.5 }, SIZE * SIZE),
  ).toBeNull();
  let s = setup();
  s.taming.creatures[0] = {
    ...s.taming.creatures[0],
    owner: "a",
    feeds: 3,
    mode: "follow",
  };
  const a = actor();
  a.position = { x: 80.5, y: 64.5 };
  s.taming = stepTaming(divided, s.taming, [a], new Set(["a"]), 1);
  expect(s.taming.creatures[0].mode).toBe("recovering");
  expect(s.taming.creatures[0].position.x).toBeLessThan(63);
  const obstacle = w.tiles.find(
    (t) =>
      t.blocker &&
      t.x > 2 &&
      t.y > 2 &&
      !isSolid(w, t.x - 1, t.y) &&
      !isSolid(w, t.x + 1, t.y),
  )!;
  const path = route(
    w,
    { x: obstacle.x - 0.5, y: obstacle.y + 0.5 },
    { x: obstacle.x + 1.5, y: obstacle.y + 0.5 },
    SIZE * SIZE,
  );
  expect(path).not.toBeNull();
  expect(path!.length).toBeGreaterThan(2);
  expect(path!.every((p) => !collides(w, p))).toBe(true);
});

it("repeated owner commands cannot bypass the recovery retry interval", () => {
  let s = setup();
  s.taming.creatures[0] = {
    ...s.taming.creatures[0],
    owner: "a",
    mode: "recovering",
    recallAt: 100,
  };
  const target = s.taming.creatures[0].id;
  s = commandCompanion(
    world,
    s.taming,
    s.gathering,
    actor(),
    { seq: 1, action: "recall", target },
    10,
  );
  expect(s.taming.creatures[0].recallAt).toBe(100);
  s = commandCompanion(
    world,
    s.taming,
    s.gathering,
    actor(),
    { seq: 2, action: "recall", target },
    11,
  );
  expect(s.taming.receipts.a.result).toBe("cooldown");
  expect(s.taming.creatures[0].recallAt).toBe(100);
});
it("follows around an obstacle without clipping or teleporting", () => {
  const w = {
    ...world,
    tiles: world.tiles.map((t) =>
      t.x === 63 && t.y === 64 ? { ...t, blocker: "rock" as const } : t,
    ),
  };
  let s = setup();
  s.taming.creatures[0] = {
    ...s.taming.creatures[0],
    owner: "a",
    mode: "follow",
  };
  const a = actor();
  a.position = { x: 65.5, y: 64.5 };
  for (let tick = 1; tick <= 500; tick++) {
    const before = s.taming.creatures[0].position;
    s.taming = stepTaming(w, s.taming, [a], new Set(["a"]), tick);
    const after = s.taming.creatures[0].position;
    expect(collides(w, after)).toBe(false);
    expect(
      Math.hypot(after.x - before.x, after.y - before.y),
    ).toBeLessThanOrEqual(4.4 / 60 + 1e-8);
  }
  const p = s.taming.creatures[0].position;
  expect(Math.hypot(p.x - a.position.x, p.y - a.position.y)).toBeLessThan(2);
});
