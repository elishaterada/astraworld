import { it, expect } from "vitest";
import { generateWorld } from "../packages/world";
import {
  freshCombat,
  freshSlime,
  stepCombat,
  stepFriendlyFire,
  defend,
  attackRay,
} from "../packages/simulation/combat";
import { applyFrame, InputTimeline } from "../packages/simulation/realtime";
import {
  weaponSchema,
  weaponAttack,
  WEAPONS,
  type Weapon,
} from "../packages/content/weapons";
import {
  packFrames,
  parsePacket,
  type RealtimeActor,
  type Frame,
} from "../packages/protocol/realtime";
import { setWorldRule } from "../packages/simulation/world-rules";
import { freshTaming } from "../packages/simulation/taming";
const baseline = generateWorld("meadow-001"),
  world = {
    ...baseline,
    tiles: baseline.tiles.map((t) => ({ ...t, blocker: null })),
  };
const actor = (id = "a", weapon: Weapon = "blade"): RealtimeActor => ({
  id,
  name: id,
  character: "fern",
  position: { x: 64.5, y: 64.5 },
  facing: 0,
  moving: false,
  ack: 0,
  generation: 1,
  action: null,
  combat: { ...freshCombat({ x: 64.5, y: 64.5 }), weapon },
});
it("charge uses server time, releases once and is cancelled by pause/guard/stale input", () => {
  let a = applyFrame(
    world,
    actor(),
    { seq: 1, keys: 0, facing: 0, charge: true },
    1,
  );
  for (let seq = 2; seq < 30; seq++)
    a = applyFrame(world, a, { seq, keys: 0, facing: 0, charge: true }, 1);
  expect(a.combat!.charging).toBe(1);
  const hit = applyFrame(
    world,
    a,
    { seq: 30, keys: 0, facing: 0, charge: false },
    61,
  );
  expect(hit.combat!.attack!.charge).toBe(1);
  expect(hit.combat!.attack!.startedTick).toBe(61);
  expect(
    applyFrame(world, hit, { seq: 31, keys: 0, facing: 0 }, 62).combat!.attack!
      .startedTick,
  ).toBe(61);
  expect(
    applyFrame(world, a, { seq: 30, keys: 0, facing: 0, cancel: true }, 61)
      .combat!.attack,
  ).toBeNull();
  expect(
    applyFrame(world, a, { seq: 30, keys: 0, facing: 0, block: true }, 61)
      .combat!.blocking,
  ).toBe(61);
  const timeline = new InputTimeline();
  timeline.enqueue([{ seq: 1, count: 1, keys: 0, facing: 0, charge: true }], 0);
  let stale = timeline.advance(world, actor(), 1);
  for (let tick = 2; tick <= 10; tick++)
    stale = timeline.advance(world, stale, tick);
  expect(stale.combat!.charging).toBeUndefined();
  expect(stale.combat!.attack).toBeNull();
});
it("perfect frontal guard reflects, late guard chips, rear attacks deal full damage", () => {
  const a = { ...actor(), combat: { ...actor().combat!, blocking: 10 } };
  expect(defend(a, { x: 65.5, y: 64.5 }, 10, 16)).toMatchObject({
    parry: true,
    actor: { combat: { health: 100, parryTick: 16 } },
  });
  expect(defend(a, { x: 65.5, y: 64.5 }, 10, 17)).toMatchObject({
    parry: false,
    actor: { combat: { health: 97 } },
  });
  expect(defend(a, { x: 63.5, y: 64.5 }, 10, 16).actor.combat!.health).toBe(90);
  const released = applyFrame(
    world,
    applyFrame(world, actor(), { seq: 1, keys: 0, facing: 0, block: true }, 1),
    { seq: 2, keys: 0, facing: 0, block: false },
    2,
  );
  expect(
    applyFrame(world, released, { seq: 3, keys: 0, facing: 0, block: true }, 3)
      .combat!.blocking,
  ).toBeUndefined();
});
it("hostile slam parry damages the monster and cannot duplicate death", () => {
  const a = { ...actor(), combat: { ...actor().combat!, blocking: 27 } },
    slime = {
      ...freshSlime(world.seed),
      health: 10,
      position: { x: 65, y: 64.5 },
      impact: a.position,
      phase: "tell" as const,
      phaseTick: 0,
    };
  const result = stepCombat(world, [a], slime, 30, new Set(["a"]));
  expect(result.slime.health).toBe(0);
  expect(result.slime.phase).toBe("dead");
  expect(result.actors[0].combat!.health).toBe(100);
  expect(
    stepCombat(world, result.actors, result.slime, 31, new Set(["a"])).slime
      .deathTick,
  ).toBe(30);
});
it("friendly fire defaults safe; enabled damage and reflection affect only eligible present actors once", () => {
  const a = applyFrame(
      world,
      actor(),
      { seq: 1, keys: 0, facing: 0, attack: true },
      1,
    ),
    b = { ...actor("b"), position: { x: 65.5, y: 64.5 } };
  expect(
    stepFriendlyFire(world, [a, b], 10, new Set(["a", "b"]), false)[1].combat!
      .health,
  ).toBe(100);
  const hit = stepFriendlyFire(world, [a, b], 10, new Set(["a", "b"]), true);
  expect(hit[1].combat!.health).toBe(90);
  expect(
    stepFriendlyFire(world, hit, 11, new Set(["a", "b"]), true)[1].combat!
      .health,
  ).toBe(90);
  const guard = { ...b, facing: 4, combat: { ...b.combat!, blocking: 8 } };
  const parry = stepFriendlyFire(
    world,
    [a, guard],
    10,
    new Set(["a", "b"]),
    true,
  );
  expect(parry[0].combat!.health).toBe(90);
  expect(parry[1].combat!.health).toBe(100);
  expect(parry[0].combat!.attack).toBeNull();
  expect(
    stepFriendlyFire(world, [a, b], 10, new Set(["a"]), true)[1].combat!.health,
  ).toBe(100);
});
it("bow and magic sweep traveling shots, stop at walls, and consume each ray only once", () => {
  for (const weapon of ["bow", "magic"] as const) {
    const a = applyFrame(
        world,
        actor("a", weapon),
        { seq: 1, keys: 0, facing: 0, attack: true },
        1,
      ),
      p = weaponAttack(weapon),
      target = { x: 69.5, y: 64.5 };
    expect(attackRay(world, a, target, 1 + p.windup)).toBe(-1);
    const tick = 1 + p.windup + Math.floor((5 / p.range) * p.active);
    expect(attackRay(world, a, target, tick)).toBe(0);
    const w = {
      ...world,
      tiles: world.tiles.map((t) =>
        t.x === 67 && t.y === 64 ? { ...t, blocker: "rock" as const } : t,
      ),
    };
    expect(attackRay(w, a, target, tick)).toBe(-1);
    const hit = stepCombat(
      world,
      [a],
      { ...freshSlime(world.seed), position: target, home: target },
      tick,
      new Set(["a"]),
    );
    expect(hit.slime.health).toBe(30 - p.damage);
    expect(attackRay(world, hit.actors[0], target, tick + 1)).toBe(-1);
  }
});
it("all five class skills are distinct and share an authoritative cooldown across equipment changes", () => {
  for (const weapon of weaponSchema.options) {
    const a = applyFrame(
      world,
      actor("a", weapon),
      { seq: 1, keys: 0, facing: 0, skill: true },
      1,
    );
    expect(a.combat!.attack!.skill).toBe(true);
    expect(weaponAttack(weapon, 0, 1, true).damage).toBe(
      weaponAttack(weapon, 0, 0, true).damage,
    );
    expect(a.combat!.skillReady).toBe(1 + WEAPONS[weapon].cooldown);
    const swap = applyFrame(
      world,
      a,
      { seq: 2, keys: 0, facing: 0, weapon: "fists" },
      80,
    );
    expect(
      applyFrame(world, swap, { seq: 3, keys: 0, facing: 0, skill: true }, 81)
        .combat!.skillReady,
    ).toBe(a.combat!.skillReady);
  }
  expect(weaponAttack("bow", 0, 0, true).spread).toHaveLength(3);
  expect(weaponAttack("magic", 0, 0, true).radial).toBe(true);
});
it("world rules require the authenticated creator and duplicate commands cannot revert settings", () => {
  const t = freshTaming(world.seed),
    cmd = { seq: 1, action: "friendly-fire" as const, target: "on" };
  const denied = setWorldRule(undefined, t, "owner", "guest", cmd, 1);
  expect(denied.rules).toBeUndefined();
  expect(denied.taming.receipts.guest.result).toBe("forbidden");
  const enabled = setWorldRule(undefined, t, "owner", "owner", cmd, 1);
  expect(enabled.rules?.friendlyFire).toBe(true);
  expect(
    setWorldRule(
      enabled.rules,
      enabled.taming,
      "owner",
      "owner",
      { ...cmd, target: "off" },
      2,
    ).rules?.friendlyFire,
  ).toBe(true);
});
it("held controls, cancel, skill and equipment survive packing and reject conflicting or forged frames", () => {
  const frames: Frame[] = [
    { seq: 1, keys: 0, facing: 0, charge: true },
    { seq: 2, keys: 0, facing: 0, charge: true },
    { seq: 3, keys: 0, facing: 0, charge: false },
    { seq: 4, keys: 0, facing: 0, skill: true },
    { seq: 5, keys: 0, facing: 0, weapon: "bow" },
    { seq: 6, keys: 0, facing: 0, cancel: true },
  ];
  const t = new InputTimeline();
  t.enqueue(packFrames(frames), 0);
  expect([...t.queued.values()]).toEqual(frames);
  expect(() =>
    t.enqueue([{ seq: 1, count: 1, keys: 0, facing: 0, block: true }], 0),
  ).toThrow("Conflicting");
  for (const forged of [
    { weapon: "admin" },
    { charge: 99 },
    { damage: 999 },
    { parryTick: 1 },
    { friendlyFire: true },
  ])
    expect(
      parsePacket(
        JSON.stringify({
          type: "frames",
          protocolVersion: 6,
          worldId: "00000000-0000-4000-8000-000000000000",
          generation: 1,
          runs: [{ seq: 1, count: 1, keys: 0, facing: 0, ...forged }],
        }),
      ),
    ).toBeNull();
});
