import { expect, it } from "vitest";
import * as T from "three";
import {
  CAMERA_ELEVATION,
  TILE_PIXELS,
  screenToWorld,
  worldToScreen,
} from "../app/camera";
import { createModelKit, animateCharacter } from "../app/three/characters";
import { CHARACTER_IDS } from "../packages/characters";
it("pointer projection matches the actual 3D camera at different sizes and positions", () => {
  for (const [width, height] of [
    [1440, 900],
    [960, 720],
    [390, 844],
  ])
    for (const center of [
      { x: 64.5, y: 64.5 },
      { x: 1.24, y: 126.7 },
    ]) {
      const camera = new T.OrthographicCamera(
        -width / TILE_PIXELS / 2,
        width / TILE_PIXELS / 2,
        height / TILE_PIXELS / 2,
        -height / TILE_PIXELS / 2,
        0.1,
        160,
      );
      camera.position.set(
        center.x,
        Math.sin(CAMERA_ELEVATION) * 40,
        center.y + Math.cos(CAMERA_ELEVATION) * 40,
      );
      camera.lookAt(center.x, 0, center.y);
      camera.updateMatrixWorld();
      const p = { x: center.x + 3.75, y: center.y - 6.2 },
        clip = new T.Vector3(p.x, 0, p.y).project(camera),
        screen = worldToScreen(p, center, width, height);
      expect(screen.x).toBeCloseTo(((clip.x + 1) * width) / 2, 8);
      expect(screen.y).toBeCloseTo(((1 - clip.y) * height) / 2, 8);
      const restored = screenToWorld(screen, center, width, height);
      expect(restored.x).toBeCloseTo(p.x, 8);
      expect(restored.y).toBeCloseTo(p.y, 8);
    }
});
it("all four models face every protocol direction and animate actual limbs without moving their feet origin", () => {
  const kit = createModelKit();
  try {
    for (const id of CHARACTER_IDS) {
      const model = kit.character(id);
      for (let facing = 0; facing < 8; facing++) {
        animateCharacter(model, facing, true, false, 0.1, false);
        const forward = new T.Vector3(0, 0, 1).applyEuler(model.root.rotation);
        expect(forward.x).toBeCloseTo(Math.cos((facing * Math.PI) / 4));
        expect(forward.z).toBeCloseTo(Math.sin((facing * Math.PI) / 4));
        expect(Math.abs(model.legs[0].rotation.x)).toBeGreaterThan(0.1);
        expect(model.legs[1].rotation.x).toBe(-model.legs[0].rotation.x);
        expect(model.root.position.toArray()).toEqual([0, 0, 0]);
      }
      animateCharacter(model, 2, true, true, 0.1, true);
      expect(model.legs[0].rotation.x).toBe(0);
      expect(model.body.position.y).toBe(0);
      expect(model.arms[1].rotation.z).toBe(-2.3);
      animateCharacter(model, 2, false, false, 0.1, false);
      expect(model.arms[1].rotation.z).toBe(0);
      expect(model.legs[0].rotation.x).toBe(0);
    }
  } finally {
    kit.dispose();
  }
});

it("all looks tumble around the torso and reset after a roll, with reduced-motion support", () => {
  const kit = createModelKit();
  try {
    for (const id of CHARACTER_IDS) {
      const model = kit.character(id);
      animateCharacter(model, 0, true, false, 0, false, 0.5);
      expect(model.roll.rotation.x).toBeCloseTo(Math.PI);
      expect(model.body.scale.y).toBeCloseTo(0.7);
      expect(model.legs.every((leg) => leg.rotation.x < -1)).toBe(true);
      expect(model.root.position.toArray()).toEqual([0, 0, 0]);
      animateCharacter(model, 0, true, false, 0, true, 0.5);
      expect(model.roll.rotation.x).toBe(0);
      animateCharacter(model, 0, false, false, 0, false);
      expect(model.roll.position.y).toBe(0);
      expect(model.body.position.y).toBe(0);
      expect(model.body.scale.y).toBe(1);
      expect(model.legs[0].rotation.x).toBe(0);
    }
  } finally {
    kit.dispose();
  }
});
