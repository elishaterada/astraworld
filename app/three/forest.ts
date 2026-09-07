import { batchBoxes } from "./batch-boxes";
import * as T from "three";
import type { Gate } from "../../packages/protocol/utility";
import { FOREST, VINE_TARGET } from "../../packages/world/forest";
import type { Position } from "../../packages/simulation";
import { worldToScreen } from "../camera";
export function createForestView(scene: T.Scene, labels: HTMLElement) {
  const root = new T.Group(),
    vines = new T.Group(),
    geometry = new T.BoxGeometry(1, 1, 1),
    materials = new Map<number, T.MeshStandardMaterial>();
  root.add(vines);
  scene.add(root);
  const label = document.createElement("div");
  label.className = "world-name vine-label";
  labels.append(label);
  function box(
    parent: T.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
  ) {
    let material = materials.get(color);
    if (!material) {
      material = new T.MeshStandardMaterial({ color, roughness: 0.85 });
      materials.set(color, material);
    }
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  // Stone shoulders frame the three-tile passage; all high geometry stays over solid boundary tiles.
  for (const x of [62.5, 66.5]) {
    box(root, x, 1.25, 38.5, 0.9, 2.5, 0.9, 0x566969);
    box(root, x, 2.6, 38.5, 1.15, 0.3, 1.1, 0x80947b);
  }
  for (let i = 0; i < 9; i++) {
    const x = 63.15 + i * 0.33;
    box(vines, x, 0.85, 38.5, 0.16, 1.7, 0.25, 0x3b6143).rotation.z =
      Math.sin(i * 2) * 0.15;
    for (let j = 0; j < 3; j++)
      box(
        vines,
        x + (j % 2 ? -0.12 : 0.12),
        0.35 + j * 0.5,
        38.55,
        0.35,
        0.17,
        0.38,
        j === 1 ? 0x93bb6b : 0x537d50,
      );
  }
  box(vines, 64.5, 0.65, 38.5, 3, 0.12, 0.22, 0x527845);
  // Dense cool canopy borders the reward clearing without inventing walkable collision.
  for (let x = FOREST.left; x <= FOREST.right; x += 3)
    for (const z of [FOREST.top + 0.5]) {
      box(root, x + 0.5, 1.5, z, 0.65, 3, 0.65, 0x3b5148);
      box(root, x + 0.5, 3.1, z, 2.6, 1.6, 2.5, 0x284f49);
      box(root, x + 0.5, 4, z, 1.8, 0.8, 1.7, 0x3c7060);
    }
  for (const x of [FOREST.left + 0.5, FOREST.right + 0.5])
    for (let z = 29.5; z < 37; z += 3) {
      box(root, x, 1.3, z, 0.55, 2.6, 0.6, 0x3b5148);
      box(root, x, 2.8, z, 2, 1.6, 2, 0x305c51);
    }
  const batchMaterial = new T.MeshStandardMaterial({ roughness: 0.85 });
  const batches = [
    batchBoxes(root, geometry, batchMaterial),
    batchBoxes(vines, geometry, batchMaterial),
  ];
  return {
    update(
      gate: Gate | undefined,
      tick: number,
      time: number,
      reduced: boolean,
      camera: Position,
      width: number,
      height: number,
    ) {
      const progress = gate?.channel
        ? Math.min(
            1,
            Math.max(
              0,
              (tick - gate.channel.startedTick) /
                (gate.channel.endsTick - gate.channel.startedTick),
            ),
          )
        : 0;
      vines.visible = !gate?.open;
      vines.scale.y = gate?.channel && !reduced ? 1 - progress * 0.65 : 1;
      vines.position.y =
        gate?.channel && !reduced ? Math.sin(time * 24) * 0.025 : 0;
      label.textContent = gate?.open
        ? "Forest passage · Open"
        : gate?.channel
          ? `Dissolving vines · ${Math.round(progress * 100)}%`
          : "Tangled vines · Moss can clear a path";
      const p = worldToScreen({ x: 64.5, y: 38.5 }, camera, width, height);
      label.style.transform = `translate(${p.x}px, ${p.y - 75}px) translate(-50%,-100%)`;
      label.hidden =
        Math.hypot(camera.x - VINE_TARGET.x, camera.y - VINE_TARGET.y) > 10;
    },
    dispose() {
      scene.remove(root);
      label.remove();
      for (const batch of batches) batch.dispose();
      batchMaterial.dispose();
      geometry.dispose();
      for (const m of materials.values()) m.dispose();
    },
  };
}
