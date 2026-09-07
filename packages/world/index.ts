import { inForest, forestBoundary, isVineTile } from "./forest";
import { meadowLandmarks, pondDistance } from "./landmarks";
/** Pure baseline generation. Coordinates are tiles; no renderer or platform imports. */
export const SIZE = 128;
export const CHUNK_SIZE = 16;
export const GENERATION_VERSION = "meadow-3";
export const CONTENT_VERSION = "utility-1";
export const SPAWN = Object.freeze({ x: 64.5, y: 64.5 });
export type Tile = Readonly<{
  x: number;
  y: number;
  terrain: "grass" | "path" | "shore" | "water";
  variant: number;
  blocker: "tree" | "rock" | "water" | "campfire" | "log" | "vine" | null;
  id: string;
}>;
export type World = Readonly<{
  seed: string;
  tiles: readonly Tile[];
  gateOpen?: boolean;
}>;

export function seedHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++)
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}
function sample(seed: number, x: number, y: number, stream: number): number {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ stream;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function normalizeSeed(seed: string): string {
  // A pasted seed can end at half a surrogate pair at the input's length limit.
  const bounded = seed.trim().slice(0, 64);
  return (
    bounded.replace(
      /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g,
      (char) => (char.length === 2 ? char : "\uFFFD"),
    ) || "meadow-001"
  );
}

export function generateChunk(rawSeed: string, cx: number, cy: number): Tile[] {
  if (
    ![cx, cy].every(
      (n) => Number.isInteger(n) && n >= 0 && n < SIZE / CHUNK_SIZE,
    )
  )
    throw new RangeError("Chunk outside Meadow");
  const seed = normalizeSeed(rawSeed),
    hash = seedHash(seed),
    landmarks = meadowLandmarks(hash),
    tiles: Tile[] = [];
  for (let y = cy * CHUNK_SIZE; y < (cy + 1) * CHUNK_SIZE; y++) {
    for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x++) {
      const edge = x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1;
      const pond = landmarks.ponds.reduce(
        (d, p) => Math.min(d, pondDistance(x + 0.5, y + 0.5, p)),
        Infinity,
      );
      const fire = landmarks.fires.some((p) => p.x === x && p.y === y);
      const camp = landmarks.fires.some(
        (p) => Math.hypot(x - p.x, y - p.y) < 3.5,
      );
      const bench = landmarks.fires.some(
        (p) => y === p.y && Math.abs(x - p.x) === 2,
      );
      const clearing = Math.hypot(x - 64, y - 64) < 5;
      const path = Math.abs(x - 64) <= 1 || Math.abs(y - 64) <= 1;
      // Even-coordinate single-tile props leave connected walking lanes for every seed.
      const prop =
        !clearing &&
        !camp &&
        pond > 1.5 &&
        !path &&
        x % 2 === 0 &&
        y % 2 === 0 &&
        sample(hash, x, y, 719) < 0.64;
      const blocker: Tile["blocker"] = isVineTile(x, y)
        ? "vine"
        : forestBoundary(x, y)
          ? "rock"
          : inForest(x, y)
            ? null
            : fire
              ? "campfire"
              : bench
                ? "log"
                : pond < 1
                  ? "water"
                  : edge
                    ? "rock"
                    : prop
                      ? sample(hash, x, y, 131) < 0.7
                        ? sample(hash, x, y, 853) < 0.09
                          ? "log"
                          : "tree"
                        : "rock"
                      : null;
      tiles.push({
        x,
        y,
        terrain:
          inForest(x, y) || forestBoundary(x, y)
            ? Math.abs(x - 64) <= 1
              ? "path"
              : "grass"
            : pond < 1
              ? "water"
              : pond < 1.3
                ? "shore"
                : path || clearing || camp
                  ? "path"
                  : "grass",
        variant: Math.floor(sample(hash, x, y, 37) * 8),
        blocker,
        id: `${GENERATION_VERSION}:${CONTENT_VERSION}:${encodeURIComponent(seed)}:${x}:${y}`,
      });
    }
  }
  return tiles;
}
export function generateWorld(rawSeed: string): World {
  const seed = normalizeSeed(rawSeed),
    tiles = new Array<Tile>(SIZE * SIZE);
  for (let cy = 0; cy < SIZE / CHUNK_SIZE; cy++)
    for (let cx = 0; cx < SIZE / CHUNK_SIZE; cx++) {
      for (const tile of generateChunk(seed, cx, cy))
        tiles[tile.y * SIZE + tile.x] = tile;
    }
  return { seed, tiles };
}
export function isSolid(world: World, x: number, y: number): boolean {
  return (
    x < 0 ||
    y < 0 ||
    x >= SIZE ||
    y >= SIZE ||
    (world.tiles[y * SIZE + x].blocker !== null &&
      !(world.gateOpen && isVineTile(x, y)))
  );
}
