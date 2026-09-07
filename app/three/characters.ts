import * as T from "three";
import type { CharacterId } from "../../packages/characters";

/** Original modular models. +Z is forward; feet at Y=0. No gameplay statistics. */
export const LOOKS = {
  fern: {
    skin: 0xe4ae7e,
    hair: 0x4b2e23,
    shirt: 0xe9d5aa,
    coat: 0x456a40,
    pants: 0x344750,
  },
  ember: {
    skin: 0xf0bd91,
    hair: 0xb7461f,
    shirt: 0xbd622e,
    coat: 0x39454b,
    pants: 0x394049,
  },
  iris: {
    skin: 0xf2bd9c,
    hair: 0xbb5777,
    shirt: 0xeae0c1,
    coat: 0x477d9a,
    pants: 0x334c66,
  },
  hazel: {
    skin: 0x9f6242,
    hair: 0x292624,
    shirt: 0xbf933d,
    coat: 0x357b78,
    pants: 0x394a48,
  },
} as const;
export function createModelKit() {
  const geometry = new T.BoxGeometry(1, 1, 1);
  const materials = new Map<number, T.MeshStandardMaterial>();
  function box(
    parent: T.Object3D,
    color: number,
    size: [number, number, number],
    position: [number, number, number],
  ) {
    let material = materials.get(color);
    if (!material) {
      material = new T.MeshStandardMaterial({ color, roughness: 1 });
      materials.set(color, material);
    }
    const mesh = new T.Mesh(geometry, material);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function character(id: CharacterId) {
    const c = LOOKS[id],
      root = new T.Group(),
      body = new T.Group();
    root.add(body);
    box(body, c.shirt, [0.48, 0.51, 0.28], [0, 0.88, 0]);
    box(body, 0x674330, [0.5, 0.09, 0.3], [0, 0.65, 0]);
    box(body, 0xd3b568, [0.09, 0.07, 0.025], [0, 0.65, 0.16]);
    box(body, c.coat, [0.1, 0.44, 0.32], [-0.21, 0.91, 0]);
    box(body, c.coat, [0.1, 0.44, 0.32], [0.21, 0.91, 0]);
    const legs = [new T.Group(), new T.Group()],
      arms = [new T.Group(), new T.Group()];
    for (let i = 0; i < 2; i++) {
      const sign = i ? 1 : -1,
        leg = legs[i],
        arm = arms[i];
      body.add(leg, arm);
      leg.position.set(sign * 0.135, 0.62, 0);
      arm.position.set(sign * 0.33, 1.09, 0);
      box(leg, c.pants, [0.2, 0.36, 0.22], [0, -0.18, 0]);
      box(leg, 0x4c382c, [0.23, 0.18, 0.32], [0, -0.48, 0.04]);
      box(
        arm,
        id === "hazel" ? c.coat : c.shirt,
        [0.2, 0.25, 0.25],
        [0, -0.125, 0],
      );
      box(arm, c.skin, [0.17, 0.22, 0.2], [0, -0.34, 0]);
      box(arm, 0x68503b, [0.19, 0.07, 0.22], [0, -0.29, 0]);
    }
    box(body, c.skin, [0.53, 0.46, 0.44], [0, 1.38, 0.01]);
    box(body, c.hair, [0.59, 0.19, 0.49], [0, 1.65, -0.02]);
    box(body, c.hair, [0.56, 0.34, 0.13], [0, 1.43, -0.22]);
    box(body, c.hair, [0.12, 0.21, 0.13], [-0.23, 1.53, 0.21]);
    box(body, c.hair, [0.22, 0.12, 0.1], [0.12, 1.58, 0.24]);
    for (const sign of [-1, 1]) {
      box(body, 0x262a28, [0.065, 0.09, 0.025], [sign * 0.13, 1.38, 0.243]);
      box(
        body,
        0xfff1d1,
        [0.022, 0.027, 0.01],
        [sign * 0.13 - 0.012, 1.401, 0.26],
      );
      box(body, c.skin, [0.08, 0.13, 0.16], [sign * 0.3, 1.38, 0]);
    }
    box(body, 0xba775a, [0.09, 0.035, 0.025], [0, 1.26, 0.244]);
    // A single shared rig, distinctive silhouettes and accessories.
    if (id === "fern") {
      box(body, c.coat, [0.63, 0.22, 0.4], [0, 1.11, -0.03]);
      box(body, c.coat, [0.54, 0.51, 0.09], [0, 0.88, -0.23]);
      box(body, 0x89613b, [0.25, 0.26, 0.22], [0.36, 0.65, -0.05]);
      const tuft = box(body, c.hair, [0.23, 0.15, 0.24], [-0.16, 1.77, 0]);
      tuft.rotation.z = 0.2;
    } else if (id === "ember") {
      for (let i = 0; i < 3; i++) {
        const tuft = box(
          body,
          c.hair,
          [0.17, 0.22, 0.25],
          [(i - 1) * 0.18, 1.8, -0.02],
        );
        tuft.rotation.z = (i - 1) * -0.28;
      }
      box(body, c.coat, [0.58, 0.14, 0.4], [0, 1.16, 0]);
      box(body, c.coat, [0.16, 0.34, 0.09], [-0.14, 0.96, 0.21]);
      box(body, 0xd5a566, [0.06, 0.28, 0.03], [0.08, 0.88, 0.16]);
    } else if (id === "iris") {
      box(body, c.hair, [0.15, 0.43, 0.46], [-0.27, 1.4, -0.03]);
      box(body, c.hair, [0.15, 0.39, 0.46], [0.27, 1.42, -0.03]);
      box(body, c.coat, [0.59, 0.25, 0.35], [0, 0.67, 0]);
      box(body, 0xf6dc93, [0.18, 0.18, 0.07], [-0.31, 1.57, 0.24]);
      box(body, 0xf9edcc, [0.07, 0.07, 0.025], [-0.31, 1.57, 0.29]);
    } else {
      for (const sign of [-1, 1])
        for (let i = 0; i < 4; i++)
          box(
            body,
            c.hair,
            [0.14, 0.15, 0.17],
            [sign * (0.3 + (i % 2) * 0.02), 1.38 - i * 0.13, -0.05],
          );
      for (const sign of [-1, 1])
        box(body, 0xd1ac59, [0.16, 0.06, 0.19], [sign * 0.32, 0.94, -0.05]);
      box(body, c.shirt, [0.57, 0.23, 0.33], [0, 0.64, 0]);
      box(body, c.coat, [0.16, 0.38, 0.04], [0.08, 0.84, 0.16]);
    }
    const hatchet = new T.Group();
    arms[1].add(hatchet);
    box(hatchet, 0x8c6843, [0.06, 0.56, 0.06], [0, -0.42, 0.13]);
    box(hatchet, 0xa6bec1, [0.29, 0.18, 0.1], [0.09, -0.17, 0.13]);
    hatchet.visible = false;
    return {
      root,
      body,
      legs,
      arms,
      hatchet,
      id,
      rotation: 0,
      gait: 0,
      waving: false,
    };
  }
  return {
    character,
    dispose() {
      geometry.dispose();
      for (const material of materials.values()) material.dispose();
      materials.clear();
    },
  };
}
export type CharacterModel = ReturnType<
  ReturnType<typeof createModelKit>["character"]
>;
export function animateCharacter(
  model: CharacterModel,
  direction: number,
  moving: boolean,
  waving: boolean,
  time: number,
  reduced: boolean,
) {
  // Protocol facing: east=0, south=2, west=4, north=6.
  const angle = Math.PI / 2 - (direction * Math.PI) / 4;
  model.root.rotation.y = angle;
  model.rotation = angle;
  const gait = moving && !reduced ? Math.sin(time * 12) * 0.65 : 0;
  model.legs[0].rotation.x = gait;
  model.legs[1].rotation.x = -gait;
  model.arms[0].rotation.x = -gait * 0.7;
  model.arms[1].rotation.x = gait * 0.7;
  model.arms[1].rotation.z = waving
    ? -2.3 + (reduced ? 0 : Math.sin(time * 18) * 0.22)
    : 0;
  model.body.position.y =
    moving && !reduced ? Math.abs(Math.sin(time * 12)) * 0.035 : 0;
  model.gait = gait;
  model.waving = waving;
}
