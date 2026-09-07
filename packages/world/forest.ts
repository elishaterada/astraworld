/** Fixed progression skeleton; terrain variants around it remain seeded. */
export const FOREST = Object.freeze({
  left: 58,
  right: 70,
  top: 26,
  bottom: 38,
});
export const VINE_TARGET = Object.freeze({ x: 64.5, y: 39.3 });
export const isVineTile = (x: number, y: number) =>
  y === FOREST.bottom && x >= 63 && x <= 65;
export const inForest = (x: number, y: number) =>
  x > FOREST.left && x < FOREST.right && y > FOREST.top && y < FOREST.bottom;
export const forestBoundary = (x: number, y: number) =>
  x >= FOREST.left &&
  x <= FOREST.right &&
  y >= FOREST.top &&
  y <= FOREST.bottom &&
  !inForest(x, y);
