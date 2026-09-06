import { isSolid, type World } from "../world";
export type Position = Readonly<{ x: number; y: number }>;
export type Input = Readonly<{ x: number; y: number }>;
export const STEP_SECONDS = 1 / 20;
export const SPEED = 4;
export const HALF_BODY = 0.24;
const EPSILON = 1e-9;

export function collides(world: World, p: Position): boolean {
  for (
    let y = Math.floor(p.y - HALF_BODY + EPSILON);
    y <= Math.floor(p.y + HALF_BODY - EPSILON);
    y++
  )
    for (
      let x = Math.floor(p.x - HALF_BODY + EPSILON);
      x <= Math.floor(p.x + HALF_BODY - EPSILON);
      x++
    )
      if (isSolid(world, x, y)) return true;
  return false;
}
/** Sweep each axis against solid tile faces, allowing wall sliding with no tunneling. */
function sweep(
  world: World,
  p: Position,
  delta: number,
  axis: "x" | "y",
): Position {
  if (!delta) return p;
  const other = axis === "x" ? "y" : "x";
  let end = p[axis] + delta;
  const lo = Math.floor(Math.min(p[axis], end) - HALF_BODY + EPSILON);
  const hi = Math.floor(Math.max(p[axis], end) + HALF_BODY - EPSILON);
  for (let a = lo; a <= hi; a++) {
    for (
      let b = Math.floor(p[other] - HALF_BODY + EPSILON);
      b <= Math.floor(p[other] + HALF_BODY - EPSILON);
      b++
    ) {
      if (!isSolid(world, axis === "x" ? a : b, axis === "x" ? b : a)) continue;
      end =
        delta > 0
          ? Math.min(end, a - HALF_BODY)
          : Math.max(end, a + 1 + HALF_BODY);
    }
  }
  return { ...p, [axis]: end };
}
/** One fixed tick only. Reject malformed intent; position is owned by the harness. */
export function step(world: World, state: Position, input: Input): Position {
  if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) return state;
  const x = Math.max(-1, Math.min(1, input.x)),
    y = Math.max(-1, Math.min(1, input.y));
  const length = Math.max(1, Math.hypot(x, y));
  return sweep(
    world,
    sweep(world, state, (x / length) * SPEED * STEP_SECONDS, "x"),
    (y / length) * SPEED * STEP_SECONDS,
    "y",
  );
}

/** Rendering projection follows the swept L-path only when a straight blend clips a corner. */
export function interpolate(
  world: World,
  from: Position,
  to: Position,
  fraction: number,
): Position {
  const alpha = Math.max(0, Math.min(1, fraction));
  const blend = {
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
  };
  if (!collides(world, blend)) return blend;
  return alpha < 0.5
    ? { x: from.x + (to.x - from.x) * alpha * 2, y: from.y }
    : { x: to.x, y: from.y + (to.y - from.y) * (alpha * 2 - 1) };
}
