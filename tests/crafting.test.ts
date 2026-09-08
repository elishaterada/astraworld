import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { generateWorld, isSolid } from "../packages/world";
import { freshProgress, type Inventory } from "../packages/content";
import { craft } from "../packages/simulation/crafting";
import { gather, type GatheringState } from "../packages/simulation/gathering";
import { resourceNodes } from "../packages/world/resources";
import { WORKBENCH_PLOTS } from "../packages/content/crafting";
import type { RealtimeActor } from "../packages/protocol/realtime";
const world = generateWorld("meadow-001");
const actor = (id = randomUUID()): RealtimeActor => ({
  id,
  name: "Maker",
  character: "fern",
  position: { x: 68.5, y: 68.5 },
  facing: 0,
  moving: false,
  action: null,
  ack: 0,
  generation: 1,
});
const stock = (a: RealtimeActor): GatheringState => {
  const p = freshProgress();
  p.inventory[2] = { item: "wood", quantity: 12 };
  p.inventory[3] = { item: "stone", quantity: 4 };
  return { players: { [a.id]: p }, depleted: [] };
};
it("craft conserves ingredients, rejects duplicate spend, full output and insufficient inputs", () => {
  const a = actor(),
    s = stock(a),
    cmd = { seq: 1, action: "craft" as const, target: "stone-axe" };
  const next = craft(world, s, a, [a], cmd, 1);
  expect(next.players[a.id].receipt?.result).toBe("crafted");
  expect(next.players[a.id].inventory[2]?.quantity).toBe(9);
  expect(next.players[a.id].inventory[3]?.quantity).toBe(2);
  expect(
    next.players[a.id].inventory.filter((x) => x?.item === "stone-axe"),
  ).toHaveLength(1);
  expect(craft(world, next, a, [a], cmd, 40)).toBe(next);
  const full = stock(a);
  full.players[a.id].inventory = Array.from({ length: 12 }, () => ({
    item: "hatchet",
    quantity: 1,
  })) as Inventory;
  full.players[a.id].inventory[0] = { item: "wood", quantity: 4 };
  full.players[a.id].inventory[1] = { item: "stone", quantity: 3 };
  const rejected = craft(world, full, a, [a], cmd, 1);
  expect(rejected.players[a.id].receipt?.result).toBe("full");
  expect(rejected.players[a.id].inventory).toEqual(
    full.players[a.id].inventory,
  );
  const empty = { players: { [a.id]: freshProgress() }, depleted: [] };
  expect(
    craft(world, empty, a, [a], cmd, 1).players[a.id].receipt?.result,
  ).toBe("ingredients");
});
it("two players cannot place the same plot; occupied, distant and invented plots cost nothing", () => {
  const a = actor(),
    b = actor();
  b.position = { x: 70.5, y: 68.5 };
  const s = stock(a);
  s.players[b.id] = stock(b).players[b.id];
  const cmd = { seq: 1, action: "place" as const, target: "camp-north" };
  const first = craft(world, s, a, [a, b], cmd, 1);
  expect(first.players[a.id].receipt?.result).toBe("placed");
  const second = craft(world, first, b, [a, b], cmd, 1);
  expect(second.players[b.id].receipt?.result).toBe("occupied");
  expect(second.players[b.id].inventory).toEqual(s.players[b.id].inventory);
  expect(second.benches).toHaveLength(1);
  expect(isSolid({ ...world, benches: first.benches }, 69, 68)).toBe(true);
  b.position = { x: 69.5, y: 68.5 };
  expect(craft(world, s, a, [a, b], cmd, 1).players[a.id].receipt?.result).toBe(
    "occupied",
  );
  expect(
    craft(world, s, { ...a, position: { x: 64.5, y: 64.5 } }, [a], cmd, 1)
      .players[a.id].receipt?.result,
  ).toBe("range");
  expect(
    craft(world, s, a, [a], { ...cmd, target: "64:64" }, 1).players[a.id]
      .receipt?.result,
  ).toBe("missing");
});
it("camp plots and loose stones are clear across 100 seeds; Stone Axe improves tree yield", () => {
  for (let i = 0; i < 100; i++) {
    const w = generateWorld(`m7-${i}`);
    for (const p of [
      ...WORKBENCH_PLOTS,
      ...resourceNodes(w).filter((n) => n.kind === "loose-stone"),
    ])
      expect(isSolid(w, Math.floor(p.x), Math.floor(p.y))).toBe(false);
  }
  const a = actor(),
    s = stock(a);
  s.players[a.id].inventory[4] = { item: "stone-axe", quantity: 1 };
  const tree = resourceNodes(world).find(
    (n) =>
      n.kind === "tree" &&
      !isSolid(world, Math.floor(n.x) - 1, Math.floor(n.y)),
  )!;
  const next = gather(
    world,
    new Map([[tree.id, tree]]),
    s,
    a.id,
    { x: tree.x - 1, y: tree.y },
    { seq: 1, target: tree.id },
    1,
  );
  expect(next.players[a.id].inventory[2]?.quantity).toBe(17);
});

it("placement rejects creature occupancy and command schemas reject client rewards", async () => {
  const a = actor(),
    s = stock(a),
    cmd = { seq: 1, action: "place" as const, target: "camp-north" };
  expect(
    craft(world, s, a, [a], cmd, 1, [{ x: 69.5, y: 68.5 }]).players[a.id]
      .receipt?.result,
  ).toBe("occupied");
  const { gatherCommandSchema } = await import("../packages/content");
  expect(
    gatherCommandSchema.safeParse({
      ...cmd,
      output: { item: "stone-axe", quantity: 99 },
    }).success,
  ).toBe(false);
  expect(
    gatherCommandSchema.safeParse({ ...cmd, action: "grant" }).success,
  ).toBe(false);
});
