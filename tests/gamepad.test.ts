import { it, expect } from "vitest";
import { decodePad, PadEdges, type PadSample } from "../app/gamepad";
const pad = (axes = [0, 0, 0, 0], pressed: number[] = []): PadSample => ({
  id: "Xbox",
  index: 0,
  mapping: "standard",
  connected: true,
  axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({
    pressed: pressed.includes(i),
    touched: false,
    value: pressed.includes(i) ? 1 : 0,
  })),
});
it("standard Xbox buttons, radial dead zone and eight-direction aiming are mapped", () => {
  expect(decodePad(pad([0.1, 0.1, 0, 0])).x).toBe(0);
  expect(decodePad(pad([0.8, 0.8, 0, -1], [2, 4]))).toMatchObject({
    x: 1,
    y: 1,
    facing: 6,
    attack: true,
    run: true,
  });
  expect(decodePad(pad([0, 0, 1, 0], [7])).charge).toBe(true);
  expect(decodePad({ ...pad(), mapping: "" }).connected).toBe(false);
  expect(decodePad(pad([NaN, Infinity, 0, 0])).x).toBe(0);
});
it("neutral gating prevents held actions across menus, focus changes and reconnect", () => {
  const edges = new PadEdges();
  expect(edges.sample(pad([0, 0, 0, 0], [0]), "game").pressed).toEqual([]);
  edges.sample(pad(), "game");
  expect(edges.sample(pad([0, 0, 0, 0], [0]), "game").pressed).toEqual([0]);
  expect(edges.sample(pad([0, 0, 0, 0], [0]), "game").pressed).toEqual([]);
  expect(edges.sample(pad([1, 0, 0, 0], [2]), "inactive").attack).toBe(false);
  expect(edges.sample(pad([1, 0, 0, 0], [2]), "game").attack).toBe(false);
  edges.sample(pad(), "game");
  expect(edges.sample(pad([1, 0, 0, 0], [2]), "game").attack).toBe(true);
  expect(edges.sample(null, "game")).toMatchObject({
    x: 0,
    y: 0,
    attack: false,
    connected: false,
  });
  expect(edges.sample(pad([1, 0, 0, 0], [2]), "game").attack).toBe(false);
  edges.sample(pad(), "dialog");
  expect(edges.sample(pad([0, 0, 0, 0], [0]), "dialog").pressed).toEqual([0]);
  expect(edges.sample(pad([0, 0, 0, 0], [0]), "game").pressed).toEqual([]);
});
