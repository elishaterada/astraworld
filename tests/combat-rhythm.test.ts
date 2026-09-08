import { expect, it } from "vitest";
import { generateWorld } from "../packages/world";
import {
  freshCombat,
  freshSlime,
  stepCombat,
} from "../packages/simulation/combat";
import { applyFrame } from "../packages/simulation/realtime";
import { collides, HALF_BODY } from "../packages/simulation";
import type { RealtimeActor } from "../packages/protocol/realtime";
const world = generateWorld("meadow-001");
const actor = (): RealtimeActor => ({
  id: "a",
  name: "A",
  character: "fern",
  position: { x: 64.5, y: 49.5 },
  facing: 6,
  moving: false,
  ack: 0,
  generation: 1,
  action: null,
  combat: freshCombat({ x: 64.5, y: 64.5 }),
});
const frame = (seq: number) => ({
  seq,
  keys: 0,
  facing: 6,
  attack: true as const,
});
it("held attack chains three stages at server cooldowns; bursts cannot speed up the chain", () => {
  let a = actor();
  const starts: { tick: number; combo: number }[] = [];
  for (let tick = 1; tick <= 110; tick++) {
    a = applyFrame(world, a, frame(tick), tick);
    if (a.combat!.attack!.startedTick === tick)
      starts.push({ tick, combo: a.combat!.attack!.combo! });
  }
  expect(starts).toEqual([
    { tick: 1, combo: 0 },
    { tick: 37, combo: 1 },
    { tick: 67, combo: 2 },
    { tick: 109, combo: 0 },
  ]);
  let burst = applyFrame(world, actor(), frame(1), 1);
  for (let seq = 2; seq <= 60; seq++)
    burst = applyFrame(world, burst, frame(seq), 1);
  expect(burst.combat!.attack!.combo).toBe(0);
  expect(burst.combat!.attackReady).toBe(37);
  a = applyFrame(world, a, frame(200), 300);
  expect(a.combat!.attack!.combo).toBe(0);
});
it("roll cancels recovery, never windup or active strikes, and resets the combo", () => {
  const a = applyFrame(world, actor(), frame(1), 1);
  for (const tick of [5, 12])
    expect(
      applyFrame(world, a, { seq: 2, keys: 0, facing: 6, dodge: true }, tick)
        .action!.kind,
    ).toBe("attack");
  const rolled = applyFrame(
    world,
    a,
    { seq: 2, keys: 0, facing: 6, dodge: true },
    16,
  );
  expect(rolled.action!.kind).toBe("dodge");
  expect(rolled.combat!.attack).toBeNull();
  expect(rolled.combat!.combo).toBeUndefined();
  const spam = applyFrame(
    world,
    rolled,
    { seq: 3, keys: 0, facing: 6, dodge: true },
    17,
  );
  expect(spam.combat!.dodgeReady).toBe(76);
});
it("finisher damages once, interrupts a live slam, and sweeps knockback against walls", () => {
  const base = actor(),
    a = {
      ...base,
      combat: {
        ...base.combat!,
        attack: { startedTick: 1, facing: 6, combo: 2, hits: [] },
        attackReady: 43,
      },
    };
  const slime = {
    ...freshSlime(world.seed),
    phase: "tell" as const,
    phaseTick: 0,
  };
  const hit = stepCombat(world, [a], slime, 13, new Set(["a"]));
  expect(hit.slime.health).toBe(15);
  expect(hit.slime.phase).toBe("recover");
  expect(hit.slime.lastDamage).toBe(15);
  expect(hit.slime.position.y).toBeLessThan(slime.position.y);
  const repeat = stepCombat(world, hit.actors, hit.slime, 14, new Set(["a"]));
  expect(repeat.slime.health).toBe(15);
  const tiles = world.tiles.map((t) =>
    t.x === 64 && t.y === 47 ? { ...t, blocker: "rock" as const } : t,
  );
  const blocked = stepCombat(
    { ...world, tiles },
    [a],
    slime,
    13,
    new Set(["a"]),
  );
  expect(collides({ ...world, tiles }, blocked.slime.position)).toBe(false);
  expect(blocked.slime.position.y).toBeGreaterThanOrEqual(48 + HALF_BODY);
});
