import { generateWorld, SIZE, SPAWN, type World } from "../world";
import { collides, type Position } from "./index";

/** Stable reachable Meadow homes; never modifies terrain or enters the gated Forest. */
export function creatureHomes(
  seed: string,
  targets: Position[],
  world: World = generateWorld(seed),
): Position[] {
  const queue: Position[] = [SPAWN],
    seen = new Set([64 * SIZE + 64]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const [dx, dy] of [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
    ]) {
      const q = { x: p.x + dx, y: p.y + dy },
        key = Math.floor(q.y) * SIZE + Math.floor(q.x);
      if (
        q.x < 1 ||
        q.x >= SIZE - 1 ||
        q.y < 42 ||
        q.y >= SIZE - 1 ||
        seen.has(key) ||
        collides(world, q)
      )
        continue;
      seen.add(key);
      queue.push(q);
    }
  }
  const chosen: Position[] = [];
  for (const target of targets) {
    const home = queue
      .filter((p) => !chosen.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 3))
      .reduce((best, p) =>
        Math.hypot(p.x - target.x, p.y - target.y) <
        Math.hypot(best.x - target.x, best.y - target.y)
          ? p
          : best,
      );
    chosen.push({ ...home });
  }
  return chosen;
}
