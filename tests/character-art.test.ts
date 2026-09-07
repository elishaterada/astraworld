import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CHARACTER_IDS, characterId } from "../packages/characters";
import { characterSchema } from "../packages/protocol";
import atlas from "../public/art/characters-v1.json";

it("accepts the four cosmetic identities and rejects arbitrary inbound looks", () => {
  for (const id of CHARACTER_IDS) expect(characterSchema.parse(id)).toBe(id);
  expect(characterSchema.safeParse("admin").success).toBe(false);
  expect(characterId(undefined)).toBe("fern");
});

it("ships a distinct RGBA sheet with nine valid, disjoint frames for every character", () => {
  const files = new Set<string>();
  for (const id of CHARACTER_IDS) {
    const sheet = atlas[id];
    const png = readFileSync(`public/art/${sheet.source}`);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(sheet.width);
    expect(png.readUInt32BE(20)).toBe(sheet.height);
    expect(png[25]).toBe(6); // PNG RGBA, never a baked checkerboard RGB draft.
    files.add(sheet.source);
    expect(sheet.frames).toHaveLength(9);
    for (const [i, frame] of sheet.frames.entries()) {
      expect(frame.width).toBeGreaterThan(0);
      expect(frame.height).toBeGreaterThan(0);
      expect(frame.x).toBeGreaterThanOrEqual(0);
      expect(frame.y).toBeGreaterThanOrEqual(0);
      expect(frame.x + frame.width).toBeLessThanOrEqual(sheet.width);
      expect(frame.y + frame.height).toBeLessThanOrEqual(sheet.height);
      for (const other of sheet.frames.slice(i + 1)) {
        expect(
          frame.x >= other.x + other.width ||
            other.x >= frame.x + frame.width ||
            frame.y >= other.y + other.height ||
            other.y >= frame.y + frame.height,
        ).toBe(true);
      }
    }
  }
  expect(files.size).toBe(4);
});
