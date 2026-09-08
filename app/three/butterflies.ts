import * as T from "three";
/** A small cosmetic flock; never networked actors or collision. */
export function createButterflies(scene: T.Scene) {
  const geometry = new T.BoxGeometry(1, 1, 1),
    material = new T.MeshBasicMaterial({ color: 0xf5d996 }),
    mesh = new T.InstancedMesh(geometry, material, 24),
    dummy = new T.Object3D();
  mesh.frustumCulled = false;
  scene.add(mesh);
  for (let i = 0; i < 24; i++)
    mesh.setColorAt(
      i,
      new T.Color(i % 6 < 2 ? 0xf1d897 : i % 6 < 4 ? 0xcbdbea : 0xd5b3d4),
    );
  return {
    update(time: number, reduced: boolean, p: { x: number; y: number }) {
      const t = reduced ? 0 : time;
      for (let i = 0; i < 12; i++) {
        const baseX = 57 + Math.sin(i * 17.1) * 13,
          baseZ = 64 + Math.cos(i * 9.7) * 13;
        const x =
            baseX +
            Math.round((p.x - baseX) / 36) * 36 +
            Math.sin(t * 0.42 + i) * 0.8,
          z =
            baseZ +
            Math.round((p.y - baseZ) / 36) * 36 +
            Math.cos(t * 0.36 + i) * 0.7;
        for (let side = 0; side < 2; side++) {
          dummy.position.set(
            x + (side ? 1 : -1) * 0.055,
            0.6 + Math.sin(t * 1.3 + i) * 0.15,
            z,
          );
          dummy.rotation.set(
            0.2,
            Math.sin(t * 0.4 + i),
            (side ? 1 : -1) * (reduced ? 0.4 : Math.sin(t * 14 + i) * 0.8),
          );
          dummy.scale.set(0.12, 0.016, 0.14);
          dummy.updateMatrix();
          mesh.setMatrixAt(i * 2 + side, dummy.matrix);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      scene.remove(mesh);
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
