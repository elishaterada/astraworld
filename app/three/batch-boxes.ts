import * as T from "three";
/** Bake one rigid group of colored boxes into a single draw while preserving its parent animation. */
export function batchBoxes(
  parent: T.Group,
  geometry: T.BoxGeometry,
  material: T.MeshStandardMaterial,
) {
  const boxes = parent.children.filter(
    (c): c is T.Mesh<T.BoxGeometry, T.MeshStandardMaterial> =>
      c instanceof T.Mesh && c.geometry === geometry,
  );
  const batch = new T.InstancedMesh(geometry, material, boxes.length);
  boxes.forEach((box, i) => {
    box.updateMatrix();
    batch.setMatrixAt(i, box.matrix);
    batch.setColorAt(i, box.material.color);
    parent.remove(box);
  });
  batch.instanceMatrix.needsUpdate = true;
  if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
  batch.castShadow = true;
  batch.receiveShadow = true;
  batch.computeBoundingSphere();
  parent.add(batch);
  return batch;
}
