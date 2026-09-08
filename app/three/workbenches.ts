import * as T from "three";
import { WORKBENCH_PLOTS } from "../../packages/content/crafting";
/** Two bounded station models; ground markers are presentation, never authority. */
export function createWorkbenchView(scene: T.Scene) {
  const root = new T.Group(),
    geometry = new T.BoxGeometry(),
    materials: T.Material[] = [];
  scene.add(root);
  const entries = WORKBENCH_PLOTS.map((plot) => {
    const group = new T.Group(),
      bench = new T.Group(),
      marker = new T.Group();
    group.position.set(plot.x, 0, plot.y);
    group.add(bench, marker);
    root.add(group);
    function box(
      parent: T.Group,
      color: number,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) {
      const material = new T.MeshStandardMaterial({ color, roughness: 1 });
      materials.push(material);
      const mesh = new T.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(w, h, d);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
    box(bench, 0x976438, 0, 0.85, 0, 0.96, 0.18, 0.86);
    for (const x of [-0.33, 0.33])
      for (const z of [-0.28, 0.28])
        box(bench, 0x5f402b, x, 0.4, z, 0.14, 0.8, 0.14);
    box(bench, 0x634932, 0, 0.3, 0, 0.8, 0.1, 0.12);
    box(bench, 0xbcbcaf, -0.2, 1, 0, 0.3, 0.15, 0.24);
    box(bench, 0x4a3930, 0.2, 0.98, 0.05, 0.08, 0.06, 0.48);
    box(bench, 0xa6a795, 0.2, 1.02, -0.14, 0.26, 0.13, 0.13);
    for (const x of [-0.47, 0.47])
      box(marker, 0xd3b477, x, 0.03, 0, 0.045, 0.04, 0.98);
    for (const z of [-0.47, 0.47])
      box(marker, 0xd3b477, 0, 0.03, z, 0.98, 0.04, 0.045);
    bench.visible = false;
    return { id: plot.id, bench, marker };
  });
  return {
    update(benches: readonly { id: string }[]) {
      for (const e of entries) {
        e.bench.visible = benches.some((b) => b.id === e.id);
        e.marker.visible = !e.bench.visible;
      }
    },
    dispose() {
      root.removeFromParent();
      geometry.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
