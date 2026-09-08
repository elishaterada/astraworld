import { it, expect } from "vitest";
import { generateWorld, isSolid } from "../packages/world";
import {
  freshCombat,
  freshSlime,
  stepCombat,
  clearAttackLine,
} from "../packages/simulation/combat";
import { applyFrame, InputTimeline } from "../packages/simulation/realtime";
import {
  packFrames,
  parsePacket,
  type RealtimeActor,
} from "../packages/protocol/realtime";
import { collides } from "../packages/simulation";
import { freshProgress } from "../packages/content";
import { gather, emptyGathering } from "../packages/simulation/gathering";
import { resourceNodes } from "../packages/world/resources";
const world = generateWorld("meadow-001");
const actor = (id = "a"): RealtimeActor => ({
  id,
  name: "Rowan",
  character: "fern",
  position: { x: 64.5, y: 49.5 },
  facing: 6,
  moving: false,
  ack: 0,
  generation: 1,
  action: null,
  combat: freshCombat({ x: 64.5, y: 64.5 }),
});
it("blade locks facing, hits once per active window and ignores friends", () => {
  let a = applyFrame(
      world,
      actor(),
      { seq: 1, keys: 0, facing: 6, attack: true },
      1,
    ),
    slime = freshSlime(world.seed);
  let actors = [a, actor("friend")];
  for (let tick = 2; tick < 30; tick++) {
    a = applyFrame(
      world,
      actors[0],
      { seq: tick, keys: 0, facing: 2, attack: true },
      tick,
    );
    ({ actors, slime } = stepCombat(
      world,
      [a, actors[1]],
      slime,
      tick,
      new Set(["a", "friend"]),
    ));
    if (tick < 10) expect(slime.health).toBe(30);
  }
  expect(slime.health).toBe(20);
  expect(actors[0].combat!.attack!.hits).toEqual([slime.id]);
  expect(actors[1].combat!.health).toBe(100); // Tell has not impacted yet.
  expect(actors[0].combat!.attack!.facing).toBe(6);
});
it("rejects attacks out of arc, range, behind terrain, or without the blade", () => {
  for (const position of [
    { x: 64.5, y: 51 },
    { x: 64.5, y: 47.5 },
  ]) {
    const a = applyFrame(
      world,
      { ...actor(), position },
      { seq: 1, keys: 0, facing: 6, attack: true },
      1,
    );
    expect(
      stepCombat(world, [a], freshSlime(world.seed), 10, new Set(["a"])).slime
        .health,
    ).toBe(30);
  }
  expect(
    applyFrame(
      world,
      actor(),
      { seq: 1, keys: 0, facing: 6, attack: true },
      1,
      false,
    ).combat!.attack,
  ).toBeNull();
  const solid = world.tiles.find((t) => t.blocker && t.x > 2 && t.y > 2)!;
  // A diagonal clips only a tiny corner of the blocking tile; sampling can miss this.
  expect(
    clearAttackLine(
      world,
      { x: solid.x - 0.25, y: solid.y + 0.25 },
      { x: solid.x + 0.251, y: solid.y - 0.25 },
    ),
  ).toBe(false);
  expect(
    clearAttackLine(
      world,
      { x: solid.x - 0.5, y: solid.y + 0.5 },
      { x: solid.x + 1.5, y: solid.y + 0.5 },
    ),
  ).toBe(false);
});
it("dodge has bounded travel, cooldown, terrain collision and first-nine-tick invulnerability", () => {
  let a = actor();
  const from = a.position;
  a = applyFrame(world, a, { seq: 1, keys: 8, facing: 0, dodge: true }, 1);
  expect(a.combat!.invulnerableUntil).toBe(10);
  expect(a.combat!.dodgeUntil).toBe(16);
  for (let i = 2; i <= 15; i++)
    a = applyFrame(world, a, { seq: i, keys: 0, facing: 4, dodge: true }, 1); // Same-tick packet burst cannot extend dash.
  expect(
    Math.hypot(a.position.x - from.x, a.position.y - from.y),
  ).toBeLessThanOrEqual(2.500001);
  expect(a.combat!.dodgeSteps).toBe(0);
  const ready = a.combat!.dodgeReady;
  a = applyFrame(world, a, { seq: 16, keys: 0, facing: 0, dodge: true }, 20);
  expect(a.combat!.dodgeReady).toBe(ready);
  let edge = { ...actor(), position: { x: 1.5, y: 64.5 } };
  for (let t = 1; t < 60; t++)
    edge = applyFrame(
      world,
      edge,
      { seq: t, keys: 4, facing: 4, dodge: true },
      t,
    );
  expect(collides(world, edge.position)).toBe(false);
  const slam = {
    ...freshSlime(world.seed),
    phase: "tell" as const,
    phaseTick: 0,
    position: actor().position,
    impact: actor().position,
  };
  const immune = {
    ...actor(),
    combat: { ...freshCombat(actor().position), invulnerableUntil: 31 },
  };
  expect(
    stepCombat(world, [immune], slam, 30, new Set(["a"])).actors[0].combat!
      .health,
  ).toBe(100);
  expect(
    stepCombat(world, [immune], slam, 31, new Set(["a"])).actors[0].combat!
      .health,
  ).toBe(90);
});
it("slam warns, impacts once; death cancels inputs and respawns safely without touching inventory", () => {
  const a = {
    ...actor(),
    combat: { ...freshCombat({ x: 64.5, y: 64.5 }), health: 10 },
  };
  const s = {
    ...freshSlime(world.seed),
    position: a.position,
    impact: a.position,
    phase: "tell" as const,
    phaseTick: 1,
  };
  expect(
    stepCombat(world, [a], s, 30, new Set(["a"])).actors[0].combat!.health,
  ).toBe(10);
  const hit = stepCombat(world, [a], s, 31, new Set(["a"]));
  expect(hit.actors[0].combat!.health).toBe(0);
  const dead = applyFrame(
    world,
    hit.actors[0],
    { seq: 1, keys: 8, facing: 0, attack: true, dodge: true, wave: true },
    32,
  );
  expect(dead.position).toEqual(a.position);
  expect(dead.action).toBeNull();
  expect(
    stepCombat(world, [dead], hit.slime, 32, new Set(["a"])).actors[0].combat!
      .deaths,
  ).toBe(1);
  const state = emptyGathering();
  state.players.a = freshProgress();
  const nodes = resourceNodes(world),
    target = nodes[0];
  const rejected = gather(
    world,
    new Map(nodes.map((n) => [n.id, n])),
    state,
    "a",
    dead.position,
    { seq: 1, target: target.id },
    32,
    "dead",
  );
  expect(rejected.players.a.inventory).toEqual(state.players.a.inventory);
  expect(rejected.players.a.receipt!.result).toBe("dead");
  const respawn = stepCombat(world, [dead], hit.slime, 151, new Set(["a"]))
    .actors[0];
  expect(respawn.position).toEqual({ x: 64.5, y: 64.5 });
  expect(respawn.combat!.health).toBe(100);
  expect(respawn.combat!.invulnerableUntil).toBe(271);
});
it("defeat is a single retained tombstone, disconnects are not attacked, leash returns home", () => {
  const a = applyFrame(
    world,
    actor(),
    { seq: 1, keys: 0, facing: 6, attack: true },
    1,
  );
  let result = stepCombat(
    world,
    [a],
    { ...freshSlime(world.seed), health: 10 },
    10,
    new Set(["a"]),
  );
  expect(result.slime.deathTick).toBe(10);
  for (let tick = 11; tick < 300; tick++)
    result = stepCombat(
      world,
      result.actors,
      result.slime,
      tick,
      new Set(["a"]),
    );
  expect(result.slime.deathTick).toBe(10);
  expect(result.slime.health).toBe(0);
  let s = { ...freshSlime(world.seed), position: { x: 64.5, y: 54.5 } };
  for (let tick = 1; tick < 400; tick++)
    s = stepCombat(world, [actor()], s, tick, new Set()).slime;
  expect(s.phase).toBe("idle");
  expect(s.position).toEqual(s.home);
});
it("action flags survive batching; conflicting replay and forged outcomes are rejected", () => {
  const frames = [
    { seq: 1, keys: 0, facing: 6, attack: true as const },
    { seq: 2, keys: 0, facing: 6 },
    { seq: 3, keys: 0, facing: 6, dodge: true as const },
  ];
  expect(packFrames(frames)).toHaveLength(3);
  const timeline = new InputTimeline();
  timeline.enqueue(packFrames(frames), 0);
  expect(() =>
    timeline.enqueue(
      [{ seq: 1, count: 1, keys: 0, facing: 6, dodge: true }],
      0,
    ),
  ).toThrow("Conflicting replay");
  for (const forged of [
    { damage: 999 },
    { position: { x: 1, y: 1 } },
    { health: 100 },
    { attack: { target: "slime" } },
  ])
    expect(
      parsePacket(
        JSON.stringify({
          type: "frames",
          protocolVersion: 6,
          worldId: "00000000-0000-4000-8000-000000000000",
          generation: 1,
          runs: [{ seq: 1, count: 1, keys: 0, facing: 6, ...forged }],
        }),
      ),
    ).toBeNull();
});
