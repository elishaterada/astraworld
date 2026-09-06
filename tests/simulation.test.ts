import { it, expect } from "vitest";
import { generateWorld, SPAWN, SIZE, type World } from "../packages/world";
import {
  step,
  collides,
  interpolate,
  SPEED,
  STEP_SECONDS,
  HALF_BODY,
  type Position,
} from "../packages/simulation";
import { screenToWorld, worldToScreen } from "../app/camera";
const world = generateWorld("meadow-001");
function run(w: World, p: Position, input: Position, n: number) {
  for (let i = 0; i < n; i++) p = step(w, p, input);
  return p;
}
it("moves exactly four tiles per second; normalized diagonals and clamped intent", () => {
  const straight = run(world, SPAWN, { x: 1, y: 0 }, 20);
  const diagonal = run(world, SPAWN, { x: 1, y: 1 }, 20);
  expect(straight.x - SPAWN.x).toBeCloseTo(SPEED, 10);
  expect(Math.hypot(diagonal.x - SPAWN.x, diagonal.y - SPAWN.y)).toBeCloseTo(
    SPEED,
    10,
  );
  expect(step(world, SPAWN, { x: 999, y: 0 })).toEqual(
    step(world, SPAWN, { x: 1, y: 0 }),
  );
  expect(step(world, SPAWN, { x: NaN, y: 1 })).toBe(SPAWN);
  expect(step(world, SPAWN, { x: 1, y: Infinity })).toBe(SPAWN);
});
it("sweeps to exact tile faces, slides along a wall, blocks corners and map edges", () => {
  const wall: World = {
    seed: "test",
    tiles: world.tiles.map((t) => ({
      ...t,
      blocker: t.x === 68 || t.y === 68 ? "rock" : null,
    })),
  };
  const end = run(wall, SPAWN, { x: 1, y: 1 }, 100);
  expect(end.x).toBeCloseTo(68 - HALF_BODY, 10);
  expect(end.y).toBeCloseTo(68 - HALF_BODY, 10);
  expect(collides(wall, end)).toBe(false);
  const slide = run(wall, { x: 68 - HALF_BODY, y: 60 }, { x: 1, y: 1 }, 20);
  expect(slide.x).toBe(68 - HALF_BODY);
  expect(slide.y).toBeCloseTo(60 + SPEED / Math.sqrt(2), 10);
  const edge = run(world, SPAWN, { x: -1, y: 0 }, 1000);
  expect(edge.x).toBeCloseTo(1 + HALF_BODY);
  expect(collides(world, edge)).toBe(false);
});
it("never penetrates props or exceeds per-tick speed over deterministic long walks", () => {
  for (let seed = 0; seed < 12; seed++) {
    const w = generateWorld(`seed-${seed}`);
    let p: Position = SPAWN;
    for (let i = 0; i < 6000; i++) {
      const angle = Math.floor(i / 70) * 2.399963229728653;
      const next = step(w, p, { x: Math.cos(angle), y: Math.sin(angle) });
      expect(collides(w, next)).toBe(false);
      expect(Math.hypot(next.x - p.x, next.y - p.y)).toBeLessThanOrEqual(
        SPEED * STEP_SECONDS + 1e-10,
      );
      p = next;
    }
  }
});
it("stops at isolated blocker from every diagonal quadrant", () => {
  const w: World = {
    seed: "corner",
    tiles: world.tiles.map((t) => ({
      ...t,
      blocker: t.x === 64 && t.y === 64 ? "rock" : null,
    })),
  };
  for (const x of [-1, 1])
    for (const y of [-1, 1]) {
      let p: Position = { x: 64.5 - x * 2, y: 64.5 - y * 2 };
      for (let i = 0; i < 15; i++) {
        p = step(w, p, { x, y });
        expect(collides(w, p)).toBe(false);
      }
    }
});
it("camera transforms round-trip at different canvas sizes and world edges", () => {
  for (const [width, height] of [
    [1440, 900],
    [960, 540],
    [390, 640],
  ])
    for (const camera of [SPAWN, { x: 1.24, y: SIZE - 1.24 }]) {
      const p = { x: 62.123, y: 69.456 },
        screen = worldToScreen(p, camera, width, height);
      expect(screenToWorld(screen, camera, width, height).x).toBeCloseTo(
        p.x,
        12,
      );
      expect(screenToWorld(screen, camera, width, height).y).toBeCloseTo(
        p.y,
        12,
      );
    }
});

it("render interpolation cannot cut through a blocker corner between valid ticks", () => {
  const w: World = {
    seed: "corner",
    tiles: world.tiles.map((t) => ({
      ...t,
      blocker: t.x === 64 && t.y === 64 ? "rock" : null,
    })),
  };
  const from = { x: 65.1, y: 63.75 },
    to = step(w, from, { x: 1, y: 1 });
  expect(collides(w, from)).toBe(false);
  expect(collides(w, to)).toBe(false);
  for (let i = 0; i <= 100; i++)
    expect(collides(w, interpolate(w, from, to, i / 100))).toBe(false);
});
