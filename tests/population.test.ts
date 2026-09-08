import { commandCompanion } from "../packages/simulation/taming";
import { freshProgress } from "../packages/content";
import { emptyGathering } from "../packages/simulation/gathering";
import { expect, it } from "vitest";
import { generateWorld } from "../packages/world";
import { collides } from "../packages/simulation";
import {
  expandMonsters,
  freshMonsters,
  freshSlime,
  freshCombat,
  stepEncounters,
} from "../packages/simulation/combat";
import {
  freshTaming,
  expandTaming,
  route,
} from "../packages/simulation/taming";
import type { RealtimeActor } from "../packages/protocol/realtime";

it("six hostile and eight pet identities have deterministic reachable homes across seeds", () => {
  for (let i = 0; i < 20; i++) {
    const seed = `population-${i}`,
      world = generateWorld(seed);
    const monsters = [freshSlime(seed), ...freshMonsters(seed)],
      pets = freshTaming(seed).creatures;
    expect(monsters).toHaveLength(6);
    expect(pets).toHaveLength(8);
    expect(new Set([...monsters, ...pets].map((m) => m.id)).size).toBe(14);
    expect(freshMonsters(seed)).toEqual(monsters.slice(1));
    for (const c of [...monsters, ...pets]) {
      expect(collides(world, c.home)).toBe(false);
      expect(route(world, { x: 64.5, y: 64.5 }, c.home, 16384)).not.toBeNull();
    }
  }
});
it("old saves gain missing creatures exactly once without replacing ownership or defeat", () => {
  const seed = "meadow-001",
    saved = freshTaming(seed);
  saved.creatures = saved.creatures.slice(0, 2);
  saved.creatures[0].owner = "friend";
  saved.creatures[0].mode = "stay";
  const expanded = expandTaming(seed, saved);
  expect(expanded.creatures).toHaveLength(8);
  expect(expanded.creatures[0]).toEqual(saved.creatures[0]);
  expect(expandTaming(seed, expanded)).toEqual(expanded);
  const monsters = freshMonsters(seed);
  monsters[2].health = 0;
  monsters[2].phase = "dead";
  monsters[2].deathTick = 30;
  expect(expandMonsters(seed, monsters)).toEqual(monsters);
});
it("one blade swing hits each monster once and killing strikes interrupt every slam", () => {
  const world = generateWorld("meadow-001");
  const a: RealtimeActor = {
    id: "a",
    name: "A",
    character: "fern",
    position: { x: 64.5, y: 49.5 },
    facing: 6,
    moving: false,
    ack: 0,
    generation: 1,
    action: null,
    combat: {
      ...freshCombat({ x: 64.5, y: 64.5 }),
      attack: { startedTick: 1, facing: 6, hits: [] },
      attackReady: 37,
    },
  };
  const enemies = Array.from({ length: 6 }, (_, i) => ({
    ...freshSlime(world.seed),
    id: `enemy-${i}`,
    health: 10,
    phase: "tell" as const,
    phaseTick: -20,
    impact: a.position,
  }));
  const result = stepEncounters(world, [a], enemies, 10, new Set(["a"]));
  expect([result.slime, ...result.monsters].every((m) => m.health === 0)).toBe(
    true,
  );
  expect(result.actors[0].combat!.health).toBe(100);
  expect(result.actors[0].combat!.attack!.hits).toHaveLength(6);
  const again = stepEncounters(
    world,
    result.actors,
    [result.slime, ...result.monsters],
    11,
    new Set(["a"]),
  );
  expect(again.actors[0].combat!.attack!.hits).toHaveLength(6);
  const vulnerable = {
    ...a,
    combat: { ...a.combat!, attack: null, health: 10 },
  };
  const lethal = stepEncounters(
    world,
    [vulnerable],
    enemies,
    10,
    new Set(["a"]),
  );
  expect(lethal.actors[0].combat!.deaths).toBe(1);
  const revived = stepEncounters(
    world,
    lethal.actors,
    [lethal.slime, ...lethal.monsters],
    130,
    new Set(["a"]),
  );
  expect(revived.actors[0].combat!.health).toBe(100);
  expect(revived.actors[0].combat!.deaths).toBe(1);
});

it("all eight players can claim distinct pets with the existing three-berry rules", () => {
  const seed = "meadow-001",
    world = generateWorld(seed);
  let state = { taming: freshTaming(seed), gathering: emptyGathering() };
  for (let i = 0; i < 8; i++) {
    const id = `player-${i}`,
      pet = state.taming.creatures[i];
    state.gathering.players[id] = freshProgress();
    state.gathering.players[id].inventory[2] = {
      item: "sweet-berry",
      quantity: 3,
    };
    const actor: RealtimeActor = {
      id,
      name: id,
      character: "fern",
      position: pet.home,
      facing: 0,
      moving: false,
      ack: 0,
      generation: 1,
      action: null,
      combat: freshCombat({ x: 64.5, y: 64.5 }),
    };
    for (let seq = 1; seq <= 3; seq++)
      state = commandCompanion(
        world,
        state.taming,
        state.gathering,
        actor,
        { seq, action: "feed", target: pet.id },
        seq * 61,
      );
    expect(state.taming.creatures[i].owner).toBe(id);
    expect(
      state.gathering.players[id].inventory.some(
        (s) => s?.item === "sweet-berry",
      ),
    ).toBe(false);
  }
  expect(new Set(state.taming.creatures.map((c) => c.owner)).size).toBe(8);
});
