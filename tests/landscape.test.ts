import { it, expect } from "vitest";
import { generateWorld, isSolid, SIZE } from "../packages/world";
import { meadowLandscape } from "../app/meadow-landscape";
it("organic trails are reproducible, connected, clear and do not change saved terrain", () => {
  for (const seed of ["meadow-001", "another-meadow", "🌱"]) {
    const w = generateWorld(seed),
      before = JSON.stringify(w),
      a = meadowLandscape(w),
      b = meadowLandscape(w);
    expect(a.trail).toEqual(b.trail);
    expect(JSON.stringify(w)).toBe(before);
    const cells = Array.from(a.trail.keys()).filter((i) => a.trail[i]);
    expect(cells.length).toBeGreaterThan(150);
    expect(
      cells.filter(
        (i) =>
          Math.abs((i % SIZE) - 64) > 4 &&
          Math.abs(Math.floor(i / SIZE) - 64) > 4,
      ).length,
    ).toBeGreaterThan(100);
    for (const i of cells)
      expect(isSolid(w, i % SIZE, Math.floor(i / SIZE))).toBe(false);
    const seen = new Set([cells[0]]),
      queue = [cells[0]];
    for (let i = 0; i < queue.length; i++)
      for (const n of [
        queue[i] - 1,
        queue[i] + 1,
        queue[i] - SIZE,
        queue[i] + SIZE,
      ])
        if (a.trail[n] && !seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
    expect(seen.size).toBe(cells.length);
    for (const x of [60, 64, 70]) expect(a.color(x, 65)).toBe(b.color(x, 65));
  }
});
