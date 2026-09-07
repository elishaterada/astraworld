import { expect, it } from "vitest";
import { generateWorld, seedHash, SIZE } from "../packages/world";
import { meadowLandmarks } from "../packages/world/landmarks";
import { collides, step } from "../packages/simulation";
import { packetSchema } from "../packages/protocol/realtime";
import { SESSION_STORAGE_KEY } from "../packages/protocol/capacity";
it("ponds, bonfires and seating are solid while eight spawn slots and their main paths stay clear", () => {
  for (let seed = 0; seed < 30; seed++) {
    const name = `environment-${seed}`,
      w = generateWorld(name),
      landmarks = meadowLandmarks(seedHash(name));
    expect(w.tiles.filter((t) => t.terrain === "water").length).toBeGreaterThan(
      300,
    );
    for (const fire of landmarks.fires)
      expect(w.tiles[fire.y * SIZE + fire.x].blocker).toBe("campfire");
    for (let i = 0; i < 8; i++)
      expect(collides(w, { x: 64.5 + i * 2, y: 64.5 })).toBe(false);
    for (let x = 1; x < 127; x++)
      expect(collides(w, { x: x + 0.5, y: 64.5 })).toBe(false);
    const water = w.tiles.find(
      (t) => t.terrain === "water" && !w.tiles[t.y * SIZE + t.x - 1].blocker,
    )!;
    let p = { x: water.x - 0.5, y: water.y + 0.5 };
    for (let i = 0; i < 20; i++) p = step(w, p, { x: 1, y: 0 });
    expect(p.x).toBeCloseTo(water.x - 0.24, 6);
    expect(collides(w, p)).toBe(false);
  }
});
it("isolates incompatible old terrain sessions", () => {
  expect(SESSION_STORAGE_KEY).toContain("m6");
  const hello = {
    type: "hello",
    protocolVersion: 2,
    worldId: "00000000-0000-4000-8000-000000000001",
    token: "a".repeat(43),
    generationVersion: "meadow-3",
    contentVersion: "utility-1",
  };
  expect(packetSchema.safeParse(hello).success).toBe(true);
  expect(
    packetSchema.safeParse({
      ...hello,
      generationVersion: "meadow-1",
      contentVersion: "placeholder-1",
    }).success,
  ).toBe(false);
});
