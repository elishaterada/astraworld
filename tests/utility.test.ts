import { it, expect } from "vitest";
import { generateWorld, isSolid } from "../packages/world";
import { freshTaming, stepTaming } from "../packages/simulation/taming";
import { commandDissolve, stepUtility } from "../packages/simulation/utility";
import { freshCombat } from "../packages/simulation/combat";
import { companionCommandSchema } from "../packages/protocol/taming";
import type { RealtimeActor } from "../packages/protocol/realtime";
const world = generateWorld("meadow-001");
function setup() {
  const a: RealtimeActor = {
    id: "a",
    name: "A",
    character: "iris",
    position: { x: 64.5, y: 39.5 },
    generation: 1,
    ack: 0,
    facing: 6,
    moving: false,
    action: null,
    combat: freshCombat({ x: 64.5, y: 64.5 }),
  };
  const s = freshTaming(world.seed);
  s.creatures[0] = {
    ...s.creatures[0],
    owner: "a",
    mode: "follow",
    feeds: 3,
    position: { x: 64.5, y: 40.5 },
  };
  return {
    a,
    s,
    cmd: { seq: 1, target: s.gate.id, action: "dissolve" as const },
  };
}
it("opens exactly at channel completion; duplicate intents and late competitors cannot re-open or re-close", () => {
  let { a, s, cmd } = setup();
  s = commandDissolve(world, s, a, cmd, 10);
  expect(s.receipts.a.result).toBe("channeling");
  expect(isSolid({ ...world, gateOpen: s.gate.open }, 64, 38)).toBe(true);
  const pending = s;
  expect(commandDissolve(world, s, a, cmd, 30)).toBe(pending);
  s = stepUtility(world, s, [a], new Set(["a"]), 69);
  expect(s.gate.open).toBe(false);
  s = stepUtility(world, s, [a], new Set(["a"]), 70);
  expect(s.gate.openedTick).toBe(70);
  expect(s.receipts.a.result).toBe("opened");
  expect(isSolid({ ...world, gateOpen: s.gate.open }, 64, 38)).toBe(false);
  expect(stepUtility(world, s, [a], new Set(["a"]), 71)).toBe(s);
  s = commandDissolve(world, s, a, { ...cmd, seq: 2 }, 80);
  expect(s.receipts.a.result).toBe("already-open");
  expect(s.gate.openedTick).toBe(70);
  s = JSON.parse(JSON.stringify(s));
  s = stepTaming({ ...world, gateOpen: true }, s, [], new Set(), 90);
  expect(s.gate.open).toBe(true);
});
it("validates ownership, target, range, line, living actor, follow mode and cooldown", () => {
  for (const reason of [
    "forbidden",
    "missing",
    "range",
    "blocked",
    "dead",
    "busy",
    "cooldown",
  ]) {
    let { a, s, cmd } = setup();
    let w = world;
    if (reason === "forbidden") a.id = "b";
    if (reason === "missing") cmd.target = "ordinary-tree";
    if (reason === "range") s.creatures[0].position = { x: 64.5, y: 43.5 };
    if (reason === "blocked")
      w = {
        ...world,
        tiles: world.tiles.map((t) =>
          t.x === 64 && t.y === 40 ? { ...t, blocker: "rock" as const } : t,
        ),
      };
    if (reason === "dead") a.combat!.health = 0;
    if (reason === "busy") s.creatures[0].mode = "stay";
    if (reason === "cooldown") s.creatures[0].controlReady = 50;
    s = commandDissolve(w, s, a, cmd, 10);
    expect(s.receipts[a.id].result).toBe(reason);
    expect(s.gate.channel).toBeNull();
    expect(s.gate.open).toBe(false);
  }
  expect(
    companionCommandSchema.safeParse({
      seq: 1,
      target: "vine",
      action: "dissolve",
      open: true,
    }).success,
  ).toBe(false);
});
it("revalidates disconnect, replacement generation, death, combat, range and stay at completion; cancelled channels can retry", () => {
  for (const reason of [
    "disconnect",
    "generation",
    "death",
    "combat",
    "range",
    "stay",
  ]) {
    let { a, s, cmd } = setup();
    s = commandDissolve(world, s, a, cmd, 10);
    if (reason === "generation") a.generation = 2;
    if (reason === "death") a.combat!.health = 0;
    if (reason === "combat") a.combat!.attackReady = 100;
    if (reason === "range") a.position = { x: 64.5, y: 44.5 };
    if (reason === "stay") s.creatures[0].mode = "stay";
    s = stepUtility(
      world,
      s,
      [a],
      new Set(reason === "disconnect" ? [] : ["a"]),
      70,
    );
    expect(s.gate.open).toBe(false);
    expect(s.gate.channel).toBeNull();
    expect(s.receipts.a.result).toBe("cancelled");
    const reset = setup();
    a = reset.a;
    s.creatures[0] = { ...reset.s.creatures[0], controlReady: 130 };
    s = commandDissolve(world, s, a, { ...cmd, seq: 2 }, 130);
    s = stepUtility(world, s, [a], new Set(["a"]), 190);
    expect(s.gate.open).toBe(true);
  }
});
it("competing valid owners yield one channel and one shared opening", () => {
  let { a, s, cmd } = setup();
  const b = { ...a, id: "b" };
  s.creatures[1] = {
    ...s.creatures[1],
    owner: "b",
    feeds: 3,
    mode: "follow",
    position: { x: 65.5, y: 40.5 },
  };
  s = commandDissolve(world, s, a, cmd, 1);
  s = commandDissolve(world, s, b, cmd, 1);
  expect(s.receipts.b.result).toBe("busy");
  expect(s.gate.channel!.player).toBe("a");
  s = stepUtility(world, s, [a, b], new Set(["a", "b"]), 61);
  expect(s.gate.open).toBe(true);
  expect(s.gate.openedTick).toBe(61);
});

it("recall honors the actual Forest gate overlay before and after opening", () => {
  const { a, s } = setup();
  a.position = { x: 64.5, y: 30.5 };
  s.creatures[0].position = { x: 64.5, y: 45.5 };
  const blocked = stepTaming(world, s, [a], new Set(["a"]), 1);
  expect(blocked.creatures[0].mode).toBe("recovering");
  expect(blocked.creatures[0].position.y).toBeGreaterThan(38);
  const open = stepTaming(
    { ...world, gateOpen: true },
    blocked,
    [a],
    new Set(["a"]),
    61,
  );
  expect(open.creatures[0].position.y).toBeLessThan(38);
  expect(open.creatures[0].mode).toBe("follow");
});
