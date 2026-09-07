import { batchBoxes } from "./batch-boxes";
import * as T from "three";
import type { Moss } from "../../packages/protocol/taming";
import type { World } from "../../packages/world";
import { interpolate, type Position } from "../../packages/simulation";
import { worldToScreen } from "../camera";
export function createMossView(
  scene: T.Scene,
  labels: HTMLElement,
  world: World,
) {
  const batchMaterial = new T.MeshStandardMaterial({ roughness: 0.85 });
  const geometry = new T.BoxGeometry(1, 1, 1),
    materials = new Map<number, T.MeshStandardMaterial>();
  const models = new Map<
    string,
    {
      root: T.Group;
      body: T.Group;
      label: HTMLDivElement;
      position: Position;
      batch: T.InstancedMesh;
    }
  >();
  function box(
    parent: T.Object3D,
    color: number,
    size: number[],
    position: number[],
  ) {
    let material = materials.get(color);
    if (!material) {
      material = new T.MeshStandardMaterial({ color, roughness: 0.85 });
      materials.set(color, material);
    }
    const mesh = new T.Mesh(geometry, material);
    mesh.scale.set(size[0], size[1], size[2]);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  let lastTime = 0;
  return {
    gate(open: boolean) {
      world = { ...world, gateOpen: open };
    },
    update(
      creatures: Moss[],
      names: Map<string, string>,
      camera: Position,
      width: number,
      height: number,
      time: number,
      reduced: boolean,
      tick: number,
    ) {
      const alpha =
        1 - Math.exp(-Math.min(0.1, Math.max(0, time - lastTime)) / 0.065);
      lastTime = time;
      for (const [id, m] of models)
        if (!creatures.some((c) => c.id === id)) {
          m.batch.dispose();
          scene.remove(m.root);
          m.label.remove();
          models.delete(id);
        }
      for (const c of creatures) {
        let model = models.get(c.id);
        if (!model) {
          const root = new T.Group(),
            body = new T.Group(),
            label = document.createElement("div");
          root.add(body);
          scene.add(root);
          label.className = "world-name moss-label";
          labels.append(label);
          box(body, 0x649c62, [0.82, 0.55, 0.72], [0, 0.35, 0]);
          box(body, 0x9abd71, [0.58, 0.23, 0.57], [0, 0.72, 0]);
          for (const x of [-0.18, 0.18]) {
            box(body, 0x223936, [0.09, 0.11, 0.03], [x, 0.45, 0.376]);
            box(body, 0xe8c698, [0.1, 0.035, 0.032], [x * 1.4, 0.35, 0.376]);
          }
          box(body, 0x23382c, [0.12, 0.03, 0.03], [0, 0.33, 0.378]);
          const leaf = box(body, 0x456f3a, [0.28, 0.08, 0.15], [0.07, 0.96, 0]);
          leaf.rotation.z = 0.6;
          const batch = batchBoxes(body, geometry, batchMaterial);
          model = { root, body, label, position: { ...c.position }, batch };
          models.set(c.id, model);
        }
        model.position =
          Math.hypot(
            model.position.x - c.position.x,
            model.position.y - c.position.y,
          ) > 3
            ? { ...c.position }
            : interpolate(world, model.position, c.position, alpha);
        model.root.position.set(model.position.x, 0, model.position.y);
        model.root.rotation.y = Math.PI / 2 - (c.facing * Math.PI) / 4;
        model.body.position.y = reduced
          ? 0
          : Math.abs(Math.sin(time * (c.moving ? 10 : 2))) *
            (c.moving ? 0.12 : 0.025);
        model.body.scale.setScalar(
          !reduced && tick - c.fedTick < 20 && c.fedTick > 0 ? 1.08 : 1,
        );
        const p = worldToScreen(model.position, camera, width, height);
        model.label.textContent = c.owner
          ? `${names.get(c.owner) ?? "Friend"}’s Moss · ${c.mode === "stay" ? "Staying" : c.mode === "recovering" ? "Recovering" : "Following"}`
          : c.claim
            ? `Moss Slime · ${c.feeds}/3 · ${names.get(c.claim.player) ?? "Friend"} feeding`
            : "Moss Slime · Loves Sweet Berries";
        model.label.style.transform = `translate(${p.x}px, ${p.y - 44}px) translate(-50%, -100%)`;
        model.label.hidden =
          Math.hypot(c.position.x - camera.x, c.position.y - camera.y) > 10;
      }
    },
    dispose() {
      for (const m of models.values()) {
        m.batch.dispose();
        scene.remove(m.root);
        m.label.remove();
      }
      models.clear();
      batchMaterial.dispose();
      geometry.dispose();
      for (const m of materials.values()) m.dispose();
    },
  };
}
