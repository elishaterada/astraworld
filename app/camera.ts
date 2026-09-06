import type { Position } from "../packages/simulation";
export const TILE_PIXELS = 32;
export function worldToScreen(
  p: Position,
  camera: Position,
  width: number,
  height: number,
): Position {
  return {
    x: (p.x - camera.x) * TILE_PIXELS + width / 2,
    y: (p.y - camera.y) * TILE_PIXELS + height / 2,
  };
}
export function screenToWorld(
  p: Position,
  camera: Position,
  width: number,
  height: number,
): Position {
  return {
    x: (p.x - width / 2) / TILE_PIXELS + camera.x,
    y: (p.y - height / 2) / TILE_PIXELS + camera.y,
  };
}
