import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  generateChunk,
  generateWorld,
  isSolid,
  normalizeSeed,
  SIZE,
  SPAWN,
} from "../packages/world";
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
describe("G0 deterministic Meadow", () => {
  it("reproduces terrain, blockers and unique IDs in forward/reverse/shuffled chunk orders for 100 seeds", () => {
    const coords = Array.from({ length: 64 }, (_, i) => [
      i % 8,
      Math.floor(i / 8),
    ]);
    for (let seed = 0; seed < 100; seed++) {
      const assemble = (order: number[][]) =>
        order
          .flatMap(([x, y]) => generateChunk(`seed-${seed}`, x, y))
          .sort((a, b) => a.y - b.y || a.x - b.x);
      const baseline = assemble(coords);
      expect(hash(assemble([...coords].reverse()))).toBe(hash(baseline));
      expect(
        hash(
          assemble(
            Array.from({ length: 64 }, (_, i) => coords[(i * 17 + 11) % 64]),
          ),
        ),
      ).toBe(hash(baseline));
      expect(new Set(baseline.map((t) => t.id)).size).toBe(SIZE * SIZE);
      const world = { seed: `seed-${seed}`, tiles: baseline };
      const visited = new Set<number>(),
        queue = [Math.floor(SPAWN.y) * SIZE + Math.floor(SPAWN.x)];
      visited.add(queue[0]);
      for (let i = 0; i < queue.length; i++) {
        const x = queue[i] % SIZE,
          y = Math.floor(queue[i] / SIZE);
        for (const [nx, ny] of [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ]) {
          const id = ny * SIZE + nx;
          if (!isSolid(world, nx, ny) && !visited.has(id)) {
            visited.add(id);
            queue.push(id);
          }
        }
      }
      expect(visited.size).toBe(baseline.filter((t) => !t.blocker).length);
    }
  }, 30000);
  it("varies with seed, bounds chunks and normalizes empty/long seeds", () => {
    expect(hash(generateChunk("one", 0, 0))).not.toBe(
      hash(generateChunk("two", 0, 0)),
    );
    expect(() => generateChunk("x", -1, 0)).toThrow(RangeError);
    expect(() => generateChunk("x", 0.5, 0)).toThrow(RangeError);
    expect(normalizeSeed("  ")).toBe("meadow-001");
    expect(normalizeSeed("x".repeat(100))).toHaveLength(64);
    expect(generateWorld(" meadow-001 ").seed).toBe("meadow-001");
  });
});

it("handles Unicode seeds even when the input limit splits a surrogate pair", () => {
  const seed = "x".repeat(63) + "🌱";
  expect(() => generateChunk(seed, 0, 0)).not.toThrow();
  expect(normalizeSeed(seed)).toHaveLength(64);
  expect(generateChunk("🌱 meadow", 0, 0)).toEqual(
    generateChunk("🌱 meadow", 0, 0),
  );
});

it("locks the meadow-2 / environment-1 baseline to its recorded reference hash", () => {
  expect(hash(generateWorld("meadow-001").tiles)).toBe(
    "17089f2bdb59533a29f7e3665f5f3acc135645e0eab309c0878ceb9f60bc3ddb",
  );
});
