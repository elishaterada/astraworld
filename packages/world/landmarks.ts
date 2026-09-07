/** Static environmental definitions, instantiated deterministically from the world seed. */
export function meadowLandmarks(hash: number) {
  const shift = (hash % 3) - 1;
  return {
    ponds: [
      { x: 54 + shift, y: 57, rx: 4.6, ry: 3.4 },
      { x: 86, y: 77 + shift, rx: 5.5, ry: 3.8 },
      { x: 32 + shift, y: 34, rx: 6.2, ry: 4.5 },
      { x: 94, y: 31 + shift, rx: 4.8, ry: 5.2 },
      { x: 33, y: 96 + shift, rx: 5.7, ry: 4.3 },
      { x: 94 + shift, y: 99, rx: 6, ry: 4.2 },
    ],
    fires: [
      { x: 69, y: 70 },
      { x: 38, y: 42 },
      { x: 90, y: 90 },
      { x: 97, y: 42 },
    ],
  };
}
export type MeadowLandmarks = ReturnType<typeof meadowLandmarks>;
export function pondDistance(
  x: number,
  y: number,
  pond: MeadowLandmarks["ponds"][number],
) {
  // Two overlapping ellipses create a continuous, irregular bank without isolated holes.
  return Math.min(
    Math.hypot((x - pond.x) / pond.rx, (y - pond.y) / pond.ry),
    Math.hypot(
      (x - pond.x - pond.rx * 0.5) / (pond.rx * 0.65),
      (y - pond.y + 0.8) / (pond.ry * 0.75),
    ),
  );
}
