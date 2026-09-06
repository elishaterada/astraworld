import { Assets, Rectangle, Texture } from "pixi.js";
import atlas from "../public/art/meadow-atlas.json";
import { CHUNK_SIZE, SIZE, seedHash, type World } from "../packages/world";
let loading: Promise<Texture[]> | undefined;
/** One shared atlas per page, reused across canvas remounts; frames retain the source alpha. */
export function loadMeadowArt(): Promise<Texture[]> {
  return (loading ??= Assets.load<Texture>("/art/meadow-atlas-v2.png")
    .then((source) => {
      source.source.scaleMode = "nearest";
      return atlas.frames.map(
        (frame) =>
          new Texture({
            source: source.source,
            frame: new Rectangle(frame.x, frame.y, frame.width, frame.height),
          }),
      );
    })
    .catch((error) => {
      loading = undefined;
      throw error;
    }));
}
function noise(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Cosmetic terrain texture only; generation/collision stay in packages/world. */
export function terrainTexture(world: World, cx: number, cy: number): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const pixels = context.createImageData(256, 256),
    seed = seedHash(world.seed);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const px = cx * 256 + x,
        py = cy * 256 + y,
        wx = px / 16,
        wy = py / 16;
      const tile = world.tiles[Math.floor(wy) * SIZE + Math.floor(wx)];
      const n = noise(px, py, seed),
        patch = Math.sin(wx * 0.48 + Math.sin(wy * 0.27)) * Math.cos(wy * 0.42);
      const pathDistance = Math.min(
        Math.abs(wx - 64.5 - Math.sin(wy * 0.42) * 0.22),
        Math.abs(wy - 64.5 - Math.sin(wx * 0.38) * 0.22),
      );
      const path =
        tile.terrain === "path" &&
        pathDistance <
          0.82 +
            (noise(Math.floor(px / 2), Math.floor(py / 2), seed) - 0.5) * 0.25;
      let r: number, g: number, b: number;
      if (path) {
        const grit = Math.floor(n * 11);
        r = 191 + grit;
        g = 159 + grit;
        b = 91 + grit;
        if (n > 0.97) {
          r -= 19;
          g -= 17;
          b -= 12;
        }
      } else {
        const fleck = Math.floor(n * 12),
          shade = Math.floor(patch * 8);
        r = 109 + fleck + shade;
        g = 143 + fleck + shade;
        b = 61 + Math.floor(fleck * 0.6);
        if (n > 0.95) {
          r += 13;
          g += 10;
          b += 2;
        }
        if (n < 0.045) {
          r -= 15;
          g -= 12;
          b -= 5;
        }
      }
      const i = (y * 256 + x) * 4;
      pixels.data[i] = r;
      pixels.data[i + 1] = g;
      pixels.data[i + 2] = b;
      pixels.data[i + 3] = 255;
    }
  context.putImageData(pixels, 0, 0);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  return texture;
}
