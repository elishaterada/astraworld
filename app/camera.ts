import type { Position } from "../packages/simulation";
// Fixed elevated orthographic view. East remains screen-right; south screen-down.
export const TILE_PIXELS = 48;
export const CAMERA_ELEVATION = Math.PI / 4;
export const GROUND_COMPRESSION = Math.sin(CAMERA_ELEVATION);
export function worldToScreen(
  p: Position,
  camera: Position,
  width: number,
  height: number,
): Position {
  return {
    x: (p.x - camera.x) * TILE_PIXELS + width / 2,
    y: (p.y - camera.y) * TILE_PIXELS * GROUND_COMPRESSION + height / 2,
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
    y: (p.y - height / 2) / (TILE_PIXELS * GROUND_COMPRESSION) + camera.y,
  };
}
