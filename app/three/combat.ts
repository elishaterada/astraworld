import * as T from "three";
import type { Slime } from "../../packages/protocol/combat";
import { COMBAT as C } from "../../packages/content/combat";
/** Original block-built creature and ground tells; never resolves a hit. */
export function createCombatView(scene: T.Scene) {
  const root = new T.Group(),
    body = new T.Group(),
    geometry = new T.BoxGeometry(1, 1, 1);
  const materials: T.Material[] = [];
  function box(color: number, size: number[], position: number[]) {
    const material = new T.MeshStandardMaterial({ color, roughness: 0.7 });
    materials.push(material);
    const mesh = new T.Mesh(geometry, material);
    mesh.scale.set(size[0], size[1], size[2]);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    body.add(mesh);
    return mesh;
  }
  root.add(body);
  // A taller silhouette keeps the tell-giver visible behind an approaching adventurer.
  root.scale.set(1.1, 1.5, 1.1);
  scene.add(root);
  const skin = box(0xad746c, [0.94, 0.64, 0.8], [0, 0.4, 0]);
  box(0xc69780, [0.65, 0.21, 0.6], [0, 0.81, 0]);
  for (const x of [-0.22, 0.22]) {
    box(0x241f30, [0.13, 0.14, 0.035], [x, 0.54, 0.413]);
    const brow = box(0x644355, [0.2, 0.06, 0.045], [x, 0.65, 0.418]);
    brow.rotation.z = x > 0 ? 0.25 : -0.25;
  }
  box(0xf8dfae, [0.16, 0.09, 0.045], [0, 0.32, 0.42]);
  const tellMaterial = new T.MeshBasicMaterial({
    color: 0xffb04a,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const tellGeometry = new T.RingGeometry(
    C.slamRadius - 0.085,
    C.slamRadius,
    48,
  );
  const tell = new T.Mesh(tellGeometry, tellMaterial);
  tell.rotation.x = -Math.PI / 2;
  scene.add(tell);
  const fillGeometry = new T.CircleGeometry(C.slamRadius, 48),
    fillMaterial = tellMaterial.clone();
  fillMaterial.opacity = 0.15;
  const fill = new T.Mesh(fillGeometry, fillMaterial);
  fill.rotation.x = -Math.PI / 2;
  scene.add(fill);
  root.visible = tell.visible = fill.visible = false;
  return {
    update(s: Slime | undefined, tick: number, time: number, reduced: boolean) {
      if (!s) {
        root.visible = tell.visible = fill.visible = false;
        return;
      }
      const age = tick - s.phaseTick;
      root.visible = s.health > 0 || age < 45;
      root.position.set(s.position.x, 0, s.position.y);
      const d = s.health === 0 ? Math.max(0.01, 1 - age / 45) : 1;
      const hop =
        !reduced && s.phase === "chase"
          ? Math.abs(Math.sin(time * 9)) * 0.16
          : 0;
      body.position.y = hop;
      body.scale.set(d, s.phase === "tell" ? 0.72 * d : d, d);
      skin.material.color.setHex(
        tick - s.damageTick < 9 && s.damageTick > 0 ? 0xffeed0 : 0xad746c,
      );
      const active = s.phase === "tell" || (s.phase === "recover" && age < 8);
      tell.visible = fill.visible = active;
      tell.position.set(s.impact.x, 0.05, s.impact.y);
      fill.position.copy(tell.position);
      fill.position.y = 0.04;
      tellMaterial.color.setHex(s.phase === "tell" ? 0xffb04a : 0xff6246);
      fillMaterial.color.copy(tellMaterial.color);
      fillMaterial.opacity =
        s.phase === "tell" ? 0.1 + 0.2 * Math.min(1, age / C.tellTicks) : 0.42;
      fill.scale.setScalar(
        s.phase === "tell" ? Math.max(0.05, Math.min(1, age / C.tellTicks)) : 1,
      );
    },
    dispose() {
      scene.remove(root, tell, fill);
      geometry.dispose();
      tellGeometry.dispose();
      fillGeometry.dispose();
      tellMaterial.dispose();
      fillMaterial.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
