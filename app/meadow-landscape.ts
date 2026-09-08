import { isSolid, seedHash, SIZE, type World } from "../packages/world";
import { meadowLandmarks } from "../packages/world/landmarks";
import { inForest } from "../packages/world/forest";

/** Cosmetic, seeded landscape over the saved collision baseline. Never edits a world. */
export function meadowLandscape(world: World) {
  const seed = seedHash(world.seed),
    trail = new Uint8Array(SIZE * SIZE);
  const noise = (x: number, y: number, scale: number, salt = 0) => {
    const a = x / scale,
      b = y / scale,
      ix = Math.floor(a),
      iy = Math.floor(b);
    const smooth = (t: number) => t * t * (3 - 2 * t),
      u = smooth(a - ix),
      v = smooth(b - iy);
    const n = (x: number, y: number) =>
      seedHash(`${seed + salt}:${x}:${y}`) / 4294967295;
    return (
      (n(ix, iy) * (1 - u) + n(ix + 1, iy) * u) * (1 - v) +
      (n(ix, iy + 1) * (1 - u) + n(ix + 1, iy + 1) * u) * v
    );
  };
  const clear = (x: number, y: number) =>
    x > 0 && y > 0 && x < SIZE - 1 && y < SIZE - 1 && !isSolid(world, x, y);
  function nearest(x: number, y: number) {
    for (let r = 0; r < 12; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++)
          if (
            Math.max(Math.abs(dx), Math.abs(dy)) === r &&
            clear(x + dx, y + dy)
          )
            return (y + dy) * SIZE + x + dx;
    return 64 * SIZE + 64;
  }
  function connect(start: number, end: number) {
    const queue = [start],
      parent = new Int32Array(SIZE * SIZE).fill(-1);
    parent[start] = start;
    for (let i = 0; i < queue.length && parent[end] === -1; i++) {
      const id = queue[i],
        x = id % SIZE,
        y = Math.floor(id / SIZE);
      // Prefer the goal-facing axis; intermediate waypoints create meanders.
      const steps = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].sort(
        (a, b) =>
          Math.hypot(
            x + a[0] - (end % SIZE),
            y + a[1] - Math.floor(end / SIZE),
          ) -
          Math.hypot(
            x + b[0] - (end % SIZE),
            y + b[1] - Math.floor(end / SIZE),
          ),
      );
      for (const [dx, dy] of steps) {
        const nx = x + dx,
          ny = y + dy,
          n = ny * SIZE + nx;
        if (clear(nx, ny) && parent[n] === -1) {
          parent[n] = id;
          queue.push(n);
        }
      }
    }
    if (parent[end] === -1) return;
    for (let id = end; ; id = parent[id]) {
      trail[id] = 1;
      if (id === start) break;
    }
  }
  const routes = [
    [
      [64, 64],
      [60, 58],
      [61, 52],
      [66, 47],
      [64, 41],
    ],
    [
      [64, 64],
      [68, 65],
      [70, 68],
      [69, 72],
    ],
    [
      [64, 64],
      [57, 67],
      [51, 63],
      [48, 57],
      [49, 51],
      [55, 48],
      [60, 51],
    ],
    [
      [68, 65],
      [75, 63],
      [82, 67],
      [87, 74],
      [85, 83],
      [89, 88],
    ],
    [
      [57, 67],
      [53, 75],
      [58, 82],
      [53, 91],
      [43, 97],
      [39, 91],
    ],
    [
      [49, 51],
      [43, 49],
      [39, 44],
      [37, 41],
    ],
    [
      [66, 47],
      [74, 44],
      [80, 49],
      [90, 46],
      [96, 41],
    ],
  ];
  for (const route of routes)
    for (let i = 1; i < route.length; i++)
      connect(
        nearest(...(route[i - 1] as [number, number])),
        nearest(...(route[i] as [number, number])),
      );
  const fires = meadowLandmarks(seed).fires;
  const distances = new Float32Array(SIZE * SIZE).fill(10);
  for (let id = 0; id < trail.length; id++)
    if (trail[id]) {
      const x = id % SIZE,
        y = Math.floor(id / SIZE);
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++)
          if (x + dx >= 0 && y + dy >= 0 && x + dx < SIZE && y + dy < SIZE) {
            const n = (y + dy) * SIZE + x + dx;
            distances[n] = Math.min(distances[n], Math.hypot(dx, dy));
          }
    }
  function pathAmount(x: number, y: number) {
    if (inForest(x, y)) return 0;
    const ix = Math.floor(x - 0.5),
      iy = Math.floor(y - 0.5),
      u = x - 0.5 - ix,
      v = y - 0.5 - iy;
    const d = (dx: number, dy: number) =>
      distances[
        Math.max(0, Math.min(SIZE - 1, iy + dy)) * SIZE +
          Math.max(0, Math.min(SIZE - 1, ix + dx))
      ];
    let distance =
      (d(0, 0) * (1 - u) + d(1, 0) * u) * (1 - v) +
      (d(0, 1) * (1 - u) + d(1, 1) * u) * v;
    const rough = (noise(x, y, 2.8, 83) - 0.5) * 0.65;
    let amount = Math.max(0, Math.min(1, (1.3 + rough - distance) * 1.8));
    for (const f of fires) {
      const radius = 2.6 + noise(x, y, 2, 12) * 1.1;
      amount = Math.max(
        amount,
        Math.max(
          0,
          Math.min(
            1,
            (radius - Math.hypot(x - f.x - 0.5, (y - f.y - 0.5) * 0.9)) * 1.3,
          ),
        ),
      );
    }
    // A small irregular arrival clearing, rather than a large round crossroads.
    amount = Math.max(
      amount,
      Math.max(
        0,
        Math.min(
          1,
          (1.65 + noise(x, y, 2, 4) - Math.hypot((x - 64.5) * 0.85, y - 64.5)) *
            1.3,
        ),
      ),
    );
    return amount;
  }
  function color(x: number, y: number) {
    const wet = noise(x, y, 12, 19),
      meadow = noise(x, y, 5, 53),
      p = pathAmount(x, y);
    const green = [
      73 + meadow * 29,
      111 + wet * 25 + meadow * 9,
      57 + meadow * 14 + wet * 9,
    ];
    const dirt = [157, 137, 94];
    return green
      .map((c, i) => Math.round(c * (1 - p) + dirt[i] * p))
      .reduce((n, c) => (n << 8) | c, 0);
  }
  return {
    trail,
    pathAmount,
    color,
    flowers: (x: number, y: number) => noise(x, y, 4.5, 137),
    variation: (x: number, y: number) => noise(x, y, 8, 92),
  };
}
