import { test, expect } from "vitest";
import { CONTENT, validateContent, freshProgress } from "../packages/content";
import { generateWorld, isSolid } from "../packages/world";
import { resourceNodes, CURIOUS_SLOTS } from "../packages/world/resources";
import {
  gather,
  addItems,
  emptyGathering,
} from "../packages/simulation/gathering";
import { parsePacket, REALTIME_VERSION } from "../packages/protocol/realtime";
const world = generateWorld("meadow-001"),
  nodes = resourceNodes(world),
  map = new Map(nodes.map((n) => [n.id, n]));
const bush = nodes.find((n) => n.x === 65.5 && n.y === 63.5)!;
const position = { x: 64.5, y: 63.5 };
const command = { seq: 1, target: bush.id };
const state = () => ({
  ...emptyGathering(),
  players: { a: freshProgress(), b: freshProgress() },
});
test("one final harvest wins; exact/conflicting/old retries cannot award twice", () => {
  const one = gather(world, map, state(), "a", position, command, 30);
  const two = gather(world, map, one, "b", position, command, 30);
  expect(two.depleted).toEqual([bush.id]);
  expect(two.players.a.inventory[2]).toEqual({
    item: "sweet-berry",
    quantity: 3,
  });
  expect(two.players.b.receipt?.result).toBe("depleted");
  expect(gather(world, map, two, "a", position, command, 90)).toBe(two);
  expect(
    gather(world, map, two, "a", position, { ...command, target: "other" }, 90),
  ).toBe(two);
  const recovered = JSON.parse(JSON.stringify(two));
  expect(gather(world, map, recovered, "a", position, command, 100)).toBe(
    recovered,
  );
  expect(gather(world, map, two, "intruder", position, command, 90)).toBe(two);
});
test("reject range, cooldown, capacity, wrong tool, missing and blocked without depletion", () => {
  expect(
    gather(world, map, state(), "a", { x: 20, y: 20 }, command, 30).players.a
      .receipt?.result,
  ).toBe("range");
  const full = state();
  full.players.a.inventory = Array.from({ length: 12 }, () => ({
    item: "wood" as const,
    quantity: 99,
  }));
  const rejected = gather(world, map, full, "a", position, command, 30);
  expect(rejected.players.a.receipt?.result).toBe("full");
  expect(rejected.depleted).toEqual([]);
  const cooldown = state();
  cooldown.players.a.readyTick = 31;
  expect(
    gather(world, map, cooldown, "a", position, command, 30).players.a.receipt
      ?.result,
  ).toBe("cooldown");
  expect(
    gather(
      world,
      map,
      state(),
      "a",
      position,
      { ...command, target: "missing" },
      30,
    ).players.a.receipt?.result,
  ).toBe("missing");
  const tree = nodes.find((n) => n.kind === "tree")!;
  const noTool = state();
  noTool.players.a.inventory[0] = null;
  expect(
    gather(
      world,
      map,
      noTool,
      "a",
      { x: tree.x - 1, y: tree.y },
      { seq: 1, target: tree.id },
      30,
    ).players.a.receipt?.result,
  ).toBe("tool");
  const blockedWorld = {
    ...world,
    tiles: world.tiles.map((t) =>
      t.x === 64 && t.y === 63 ? { ...t, blocker: "rock" as const } : t,
    ),
  };
  expect(
    gather(blockedWorld, map, state(), "a", position, command, 30).players.a
      .receipt?.result,
  ).toBe("blocked");
});
test("stack overflow is atomic and stable, positive integer quantities only", () => {
  const inv = freshProgress().inventory;
  inv[2] = { item: "wood", quantity: 98 };
  const next = addItems(inv, "wood", 3)!;
  expect(next[2]?.quantity).toBe(99);
  expect(next[3]).toEqual({ item: "wood", quantity: 2 });
  expect(inv[2]?.quantity).toBe(98);
  expect(addItems(inv, "wood", -1)).toBeNull();
  expect(addItems(inv, "wood", 1.5)).toBeNull();
  expect(
    addItems(
      Array.from({ length: 12 }, () => ({ item: "wood", quantity: 99 })),
      "wood",
      1,
    ),
  ).toBeNull();
});
test("100 seeds supply deterministic unique resources, six reachable berries and two clear reserved slots", () => {
  for (let i = 0; i < 100; i++) {
    const w = generateWorld(`seed-${i}`),
      resources = resourceNodes(w);
    expect(resourceNodes(w)).toEqual(resources);
    expect(new Set(resources.map((n) => n.id)).size).toBe(resources.length);
    for (const p of [
      { x: 65.5, y: 63.5 },
      { x: 63.5, y: 65.5 },
    ]) {
      expect(resources.find((n) => n.x === p.x && n.y === p.y)?.kind).toBe(
        "berry-bush",
      );
      expect(isSolid(w, Math.floor(p.x), Math.floor(p.y))).toBe(false);
    }
    for (const p of CURIOUS_SLOTS)
      expect(isSolid(w, Math.floor(p.x), Math.floor(p.y))).toBe(false);
  }
});
test("content and packets reject malformed definitions and client rewards", () => {
  expect(() =>
    validateContent({
      ...CONTENT,
      items: [...CONTENT.items, CONTENT.items[0]],
    }),
  ).toThrow();
  expect(() =>
    validateContent({
      ...CONTENT,
      items: CONTENT.items.filter((i) => i.id !== "wood"),
    }),
  ).toThrow();
  expect(() =>
    validateContent({
      ...CONTENT,
      resources: [
        { ...CONTENT.resources[0], yields: { item: "wood", quantity: -1 } },
      ],
    }),
  ).toThrow();
  const packet = {
    type: "frames",
    protocolVersion: REALTIME_VERSION,
    worldId: "00000000-0000-4000-8000-000000000001",
    generation: 1,
    runs: [],
    gather: command,
  };
  expect(parsePacket(JSON.stringify(packet))).not.toBeNull();
  expect(
    parsePacket(
      JSON.stringify({ ...packet, gather: { ...command, quantity: 99 } }),
    ),
  ).toBeNull();
});

test("full depletion overlay stays compact and survives lost snapshots", async () => {
  const { encodeDepletion, decodeDepletion } = await import(
    "../packages/protocol/resources"
  );
  const ids = nodes.map((n) => n.id),
    encoded = encodeDepletion(nodes, ids);
  expect(encoded.length).toBeLessThan(1024);
  expect(decodeDepletion(nodes, encoded)).toEqual(ids);
  expect(decodeDepletion(nodes, encodeDepletion(nodes, [bush.id]))).toEqual([
    bush.id,
  ]);
  expect(decodeDepletion(nodes, "broken")).toBeNull();
});
