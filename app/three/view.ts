import { createButterflies } from "./butterflies";
import { meadowLandscape } from "../meadow-landscape";
import { createWorkbenchView } from "./workbenches";
import { createForestView } from "./forest";
import type { Gate } from "../../packages/protocol/utility";
import { inForest } from "../../packages/world/forest";
import { createMossView } from "./moss";
import type { Moss } from "../../packages/protocol/taming";
import { createCombatView } from "./combat";
import type { Slime } from "../../packages/protocol/combat";
import { resourceNodes } from "../../packages/world/resources";
import { createAtmosphere } from "./atmosphere";
import * as T from "three";
import { type World, SIZE, CHUNK_SIZE, seedHash } from "../../packages/world";
import type { Position } from "../../packages/simulation";
import { CHARACTERS, type CharacterId } from "../../packages/characters";
import { CAMERA_ELEVATION, TILE_PIXELS, worldToScreen } from "../camera";
import {
  createModelKit,
  animateCharacter,
  type CharacterModel,
} from "./characters";

export type VisualActor = {
  id: string;
  name: string;
  character: CharacterId;
  position: Position;
  facing: number;
  moving: boolean;
  waving: boolean;
  gathering?: boolean;
  chopping?: boolean;
  attackAge?: number;
  rollProgress?: number;
  rollFacing?: number;
  health?: number;
  hurt?: boolean;
};
type Cube = {
  position: [number, number, number];
  scale: [number, number, number];
  color: number;
  rotation?: number;
  resource?: string;
};
export function createMeadowView(
  host: HTMLElement,
  world: World,
  look: CharacterId,
) {
  const renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  const scene = new T.Scene();
  scene.background = new T.Color(0x799994);
  scene.fog = new T.Fog(0x799994, 27, 80);
  const atmosphere = createAtmosphere(scene, world);
  const combatView = createCombatView(scene);
  const workbenchView = createWorkbenchView(scene);
  const butterflies = createButterflies(scene);
  const effectTime = { value: 0 };
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 160);
  const sky = new T.HemisphereLight(0xcde7e8, 0x243d3a, 1.35);
  scene.add(sky);
  const sun = new T.DirectionalLight(0xffd29a, 2.15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -23,
    right: 23,
    top: 23,
    bottom: -23,
    near: 1,
    far: 80,
  });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.0002;
  scene.add(sun, sun.target);
  const geometry = new T.BoxGeometry(1, 1, 1);
  const material = new T.MeshStandardMaterial({ roughness: 1 });
  const leavesMaterial = material.clone();
  const actorFocus = new T.Vector3();
  // Dither only foliage between the camera and the local actor, keeping feet readable.
  leavesMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.meadowTime = effectTime;
    shader.uniforms.actorFocus = { value: actorFocus };
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      "#include <common>\nvarying vec3 meadowPosition; uniform float meadowTime;",
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "transformed.x += sin(meadowTime*.8+instanceMatrix[3].x+instanceMatrix[3].z)*.025;\n#include <project_vertex>\nmeadowPosition = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nvarying vec3 meadowPosition; uniform vec3 actorFocus;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <alphatest_fragment>",
      `#include <alphatest_fragment>
      vec3 offset = meadowPosition - actorFocus;
      float projectedY = offset.z * ${Math.sin(CAMERA_ELEVATION).toFixed(8)} - offset.y * ${Math.cos(CAMERA_ELEVATION).toFixed(8)};
      if (offset.z > 0.0 && abs(offset.x) < 0.65 && abs(projectedY) < 0.85 && mod(gl_FragCoord.x + gl_FragCoord.y * 2.0, 4.0) > 0.5) discard;`,
    );
  };
  const landscape = meadowLandscape(world);
  const resources = resourceNodes(world);
  const stoneTiles = new Map(
    resources
      .filter((n) => n.kind === "loose-stone")
      .map((n) => [Math.floor(n.y) * SIZE + Math.floor(n.x), n]),
  );
  const berryTiles = new Map(
    resources
      .filter((n) => n.kind === "berry-bush")
      .map((n) => [Math.floor(n.y) * SIZE + Math.floor(n.x), n]),
  );
  const resourceInstances = new Map<
    string,
    { mesh: T.InstancedMesh; index: number }[]
  >();
  const removed = new Set<string>();
  const chunks: { center: Position; meshes: T.InstancedMesh[] }[] = [];
  const dummy = new T.Object3D(),
    color = new T.Color();
  function batch(cubes: Cube[], m: T.Material, shadow: boolean) {
    const mesh = new T.InstancedMesh(geometry, m, cubes.length);
    for (let i = 0; i < cubes.length; i++) {
      const c = cubes[i];
      if (c.resource) {
        const entries = resourceInstances.get(c.resource) ?? [];
        entries.push({ mesh, index: i });
        resourceInstances.set(c.resource, entries);
      }
      dummy.position.set(...c.position);
      dummy.scale.set(...c.scale);
      dummy.rotation.set(0, c.rotation || 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.setHex(c.color));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
    return mesh;
  }
  const waterMaterial = new T.MeshStandardMaterial({
    color: 0x317b82,
    roughness: 0.23,
    metalness: 0.25,
  });
  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.meadowTime = effectTime;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      "#include <common>\nvarying vec3 waterPosition;",
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\nwaterPosition=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nvarying vec3 waterPosition;uniform float meadowTime;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float ripple=sin(waterPosition.x*4.+waterPosition.z*2.+meadowTime*.8)*sin(waterPosition.z*3.-meadowTime*.6);
      float shine=smoothstep(.985,1.,ripple);
      diffuseColor.rgb+=vec3(.14,.25,.24)*shine;`,
    );
  };
  for (let cy = 0; cy < SIZE / CHUNK_SIZE; cy++)
    for (let cx = 0; cx < SIZE / CHUNK_SIZE; cx++) {
      const water: Cube[] = [];
      const ground: Cube[] = [],
        props: Cube[] = [],
        leaves: Cube[] = [];
      const add = (
        list: Cube[],
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        color: number,
        rotation = 0,
      ) =>
        list.push({ position: [x, y, z], scale: [w, h, d], color, rotation });
      for (let y = cy * 16; y < (cy + 1) * 16; y++)
        for (let x = cx * 16; x < (cx + 1) * 16; x++) {
          const t = world.tiles[y * SIZE + x],
            v = t.variant,
            px = x + 0.5,
            pz = y + 0.5;
          add(
            ground,
            px,
            t.terrain === "water" ? -0.42 : -0.22,
            pz,
            1,
            0.44,
            1,
            t.terrain === "water"
              ? 0x2d5555
              : inForest(x, y)
                ? Math.abs(x - 64) <= 1
                  ? 0x77917a
                  : 0x486d5b
                : t.terrain === "shore"
                  ? 0x8e9770
                  : landscape.color(px, pz),
          );
          const cover = landscape.pathAmount(px, pz);
          if (
            !inForest(x, y) &&
            t.terrain !== "water" &&
            t.terrain !== "shore" &&
            cover > 0 &&
            cover < 1
          ) {
            for (let sy = 0; sy < 3; sy++)
              for (let sx = 0; sx < 3; sx++)
                add(
                  ground,
                  x + (sx + 0.5) / 3,
                  0.004,
                  y + (sy + 0.5) / 3,
                  1 / 3,
                  0.008,
                  1 / 3,
                  landscape.color(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3),
                );
          }
          const hash = seedHash(t.id);
          const stone = stoneTiles.get(y * SIZE + x);
          if (stone) {
            for (let k = 0; k < 3; k++) {
              add(
                props,
                px + (k - 1) * 0.22,
                0.12 + (k % 2) * 0.07,
                pz + (k % 2) * 0.15,
                0.3,
                0.23,
                0.28,
                k % 2 ? 0xb4b7a6 : 0x858b83,
                k * 0.7,
              );
              props.at(-1)!.resource = stone.id;
            }
          }
          const berry = berryTiles.get(y * SIZE + x);
          if (berry) {
            add(props, px, 0.28, pz, 0.76, 0.56, 0.67, 0x315f41);
            add(props, px - 0.22, 0.42, pz, 0.45, 0.4, 0.49, 0x518447);
            for (let k = 0; k < 7; k++) {
              add(
                props,
                px + Math.cos(k * 2.4) * 0.3,
                0.57 + (k % 2) * 0.09,
                pz + Math.sin(k * 2.4) * 0.28,
                0.13,
                0.13,
                0.13,
                0xd05272,
              );
              props.at(-1)!.resource = berry.id;
            }
          }
          if (t.terrain === "water") {
            add(water, px, -0.07, pz, 1, 0.04, 1, 0xffffff);
            if ((v === 1 || v === 6) && landscape.flowers(px, pz) > 0.6) {
              add(props, px, -0.025, pz, 0.36, 0.025, 0.27, 0x49764b, 0.35);
              if (v === 1)
                add(props, px + 0.07, 0.02, pz, 0.1, 0.07, 0.1, 0xe6baca);
            }
          }
          if (t.terrain === "shore" && v % 2 === 0) {
            for (let i = 0; i < 4; i++) {
              const rx = x + 0.15 + i * 0.17;
              add(
                props,
                rx,
                0.25,
                y + 0.3,
                0.035,
                0.5 + (i % 2) * 0.18,
                0.035,
                0x6a8453,
              );
              if (i % 2)
                add(props, rx, 0.64, y + 0.3, 0.08, 0.16, 0.08, 0x655036);
            }
          }
          // Small surface facets; deterministic cosmetic detail, no additional blockers.
          if (!t.blocker && v % 3 === 0)
            add(
              ground,
              x + 0.2 + (v % 2) * 0.3,
              0.006,
              y + 0.34,
              0.24,
              0.012,
              0.15,
              cover < 0.4 ? 0x8fa568 : 0xbca573,
            );
          if (t.blocker === "campfire") {
            for (let i = 0; i < 8; i++)
              add(
                props,
                px + Math.cos((i * Math.PI) / 4) * 0.43,
                0.13,
                pz + Math.sin((i * Math.PI) / 4) * 0.43,
                0.24,
                0.23,
                0.22,
                0x777e71,
                i * 0.5,
              );
            add(props, px, 0.16, pz, 0.63, 0.2, 0.2, 0x49382c, 0.55);
            add(props, px, 0.18, pz, 0.63, 0.2, 0.2, 0x573d2c, -0.55);
          } else if (t.blocker === "log") {
            add(props, px, 0.23, pz, 0.98, 0.45, 0.53, 0x554334);
            add(props, px + 0.49, 0.23, pz, 0.025, 0.35, 0.42, 0xae9260);
            add(props, px + 0.51, 0.23, pz, 0.025, 0.18, 0.2, 0x775334);
            add(props, px - 0.1, 0.48, pz, 0.5, 0.05, 0.35, 0x55724a);
          } else if (t.blocker === "tree") {
            const propStart = props.length,
              leafStart = leaves.length;
            // The mossy plinth communicates the exact full-tile solid footprint.
            add(props, px, 0.09, pz, 0.98, 0.18, 0.98, 0x435e43);
            add(props, px, 0.73, pz, 0.39, 1.32, 0.38, 0x705036);
            add(props, px - 0.07, 0.78, pz + 0.2, 0.1, 1.2, 0.045, 0x977049);
            add(props, px + 0.2, 1.1, pz, 0.5, 0.15, 0.17, 0x705036, 0.4);
            const h = 1.65 + v * 0.07;
            for (let k = 0; k < 5; k++) {
              const a = k * 2.4 + v;
              add(
                leaves,
                px + Math.cos(a) * 0.6,
                h + 0.33 + (k % 2) * 0.25,
                pz + Math.sin(a) * 0.57,
                0.48,
                0.4,
                0.47,
                k % 2 ? 0x427952 : 0x33684c,
                a * 0.1,
              );
            }
            add(leaves, px, h, pz, 1.5, 0.64, 1.36, 0x285b45, v * 0.12);
            add(
              leaves,
              px - 0.17,
              h + 0.46,
              pz - 0.09,
              1.17,
              0.55,
              1.14,
              0x387453,
              -v * 0.08,
            );
            add(
              leaves,
              px + 0.08,
              h + 0.83,
              pz - 0.04,
              0.73,
              0.35,
              0.78,
              0x548653,
              v * 0.09,
            );
            add(
              leaves,
              px + 0.57,
              h + 0.08,
              pz + 0.03,
              0.49,
              0.48,
              0.62,
              0x346649,
              -0.15,
            );
            if (v % 2 === 0)
              add(
                leaves,
                px - 0.46,
                h + 0.23,
                pz + 0.4,
                0.46,
                0.23,
                0.38,
                0x4d7c4e,
                0.2,
              );
            for (const leaf of leaves.slice(leafStart)) {
              leaf.position[0] += ((hash % 101) / 100 - 0.5) * 0.65;
              leaf.position[2] += (((hash >>> 8) % 101) / 100 - 0.5) * 0.65;
              leaf.scale[1] *= 0.8 + landscape.variation(px, pz) * 0.55;
            }
            for (const cube of [
              ...props.slice(propStart + 1),
              ...leaves.slice(leafStart),
            ])
              cube.resource = `resource:${t.id}`;
            add(props, px, 0.17, pz, 0.48, 0.34, 0.46, 0x8b6840);
          } else if (t.blocker === "rock") {
            add(props, px, 0.12, pz, 0.98, 0.24, 0.98, 0x656e5b);
            add(props, px, 0.43, pz, 0.83, 0.65, 0.79, 0x858c79, v * 0.13);
            add(
              props,
              px - 0.15,
              0.77,
              pz - 0.07,
              0.5,
              0.19,
              0.52,
              0xabb099,
              -0.12,
            );
            add(props, px + 0.27, 0.55, pz + 0.21, 0.24, 0.08, 0.35, 0x72904c);
          } else if (
            t.terrain !== "water" &&
            t.terrain !== "shore" &&
            cover < 0.35
          ) {
            const density = Math.max(
              0,
              Math.floor((landscape.flowers(px + 19, pz + 31) - 0.25) * 7),
            );
            for (let k = 0; k < density; k++) {
              const gx = x + ((hash >> (k * 3)) & 7) / 9 + 0.05,
                gz = y + ((hash >> (k * 3 + 9)) & 7) / 9 + 0.05;
              add(
                props,
                gx,
                0.13,
                gz,
                0.035,
                0.26 + (k % 2) * 0.13,
                0.035,
                0x78925a,
              );
            }
            if (landscape.flowers(px, pz) > 0.57 && v % 2 === 0)
              for (let k = 0; k < 3; k++) {
                const a = k * 2.4 + v,
                  fx = px + Math.cos(a) * 0.3,
                  fz = pz + Math.sin(a) * 0.3;
                add(props, fx, 0.16, fz, 0.04, 0.3, 0.04, 0x416942);
                add(
                  props,
                  fx,
                  0.32,
                  fz,
                  0.14,
                  0.07,
                  0.14,
                  k === 1 ? 0xd5c28b : v === 0 ? 0xc6daca : 0xae91b5,
                );
              }
            if (v === 4) {
              add(props, px, 0.16, pz, 0.42, 0.31, 0.37, 0x48714b, 0.3);
              add(
                props,
                px + 0.2,
                0.25,
                pz - 0.14,
                0.27,
                0.24,
                0.28,
                0x62814e,
                -0.2,
              );
            }
            if (v === 7) {
              add(props, x + 0.3, 0.1, y + 0.3, 0.05, 0.17, 0.05, 0xc9b98e);
              add(props, x + 0.3, 0.2, y + 0.3, 0.18, 0.06, 0.16, 0xab7155);
            }

            if ((v === 1 || v === 6) && landscape.flowers(px, pz) > 0.6) {
              add(
                props,
                x + 0.23,
                0.28,
                y + 0.22,
                0.16,
                0.09,
                0.14,
                v === 1 ? 0xe1a0a9 : 0xeee1a7,
              );
              add(
                props,
                x + 0.23,
                0.335,
                y + 0.22,
                0.055,
                0.025,
                0.055,
                0xdcb65b,
              );
            }
          }
        }
      chunks.push({
        center: { x: cx * 16 + 8, y: cy * 16 + 8 },
        meshes: [
          batch(ground, material, false),
          batch(water, waterMaterial, false),
          batch(props, material, true),
          batch(leaves, leavesMaterial, true),
        ],
      });
    }
  const targetRing = new T.Mesh(
    new T.RingGeometry(0.53, 0.57, 32),
    new T.MeshBasicMaterial({
      color: 0xf4d58d,
      side: T.DoubleSide,
      depthWrite: false,
    }),
  );
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.visible = false;
  scene.add(targetRing);
  const kit = createModelKit(),
    local = kit.character(look);
  scene.add(local.root);
  const peers = new Map<
    string,
    { model: CharacterModel; label: HTMLDivElement }
  >();
  const labels = document.createElement("div");
  labels.className = "world-labels";
  labels.setAttribute("aria-hidden", "true");
  const mossView = createMossView(scene, labels, world);
  const forestView = createForestView(scene, labels);
  let currentGate: Gate | undefined;
  let moss: Moss[] = [];
  const enemyLabel = document.createElement("div");
  enemyLabel.className = "world-name slime-label";
  labels.append(enemyLabel);
  let currentSlime: Slime | undefined;
  let combatTick = 0;
  let width = 1,
    height = 1,
    visibleProps = 0;
  function resize() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height);
    camera.left = -width / TILE_PIXELS / 2;
    camera.right = -camera.left;
    camera.top = height / TILE_PIXELS / 2;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
  }
  resize();
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement, labels);
  function update(
    model: CharacterModel,
    actor: VisualActor,
    time: number,
    reduced: boolean,
  ) {
    model.root.position.set(actor.position.x, 0, actor.position.y);
    animateCharacter(
      model,
      actor.rollProgress !== undefined
        ? (actor.rollFacing ?? actor.facing)
        : actor.facing,
      actor.moving,
      actor.waving,
      time,
      reduced,
      actor.rollProgress,
    );
    model.root.scale.setScalar(actor.health === 0 ? 0.45 : 1);
    model.body.rotation.z = actor.hurt ? 0.15 : 0;
    model.body.rotation.x = 0;
    model.blade.visible =
      actor.attackAge !== undefined &&
      actor.attackAge >= 0 &&
      actor.attackAge < 36;
    model.hatchet.visible = !!actor.gathering && !!actor.chopping;
    if (actor.gathering && !model.blade.visible) {
      model.arms[1].rotation.x = reduced ? -1 : -1 + Math.sin(time * 18) * 0.7;
      model.arms[1].rotation.z = -0.35;
    }
    if (model.blade.visible) {
      const age = actor.attackAge!;
      model.arms[1].rotation.x = reduced
        ? -1.5
        : age < 9
          ? -2.5
          : age < 15
            ? -2.5 + ((age - 9) / 6) * 2.2
            : -0.3;
      model.arms[1].rotation.z = -0.45;
    }
  }
  return {
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    get visibleProps() {
      return visibleProps;
    },
    local,
    peers,
    resize,
    gate(gate: Gate | undefined) {
      currentGate = gate;
      mossView.gate(gate?.open ?? false);
    },
    companions(creatures: Moss[]) {
      moss = creatures;
    },
    combat(slime: Slime | undefined, tick: number) {
      currentSlime = slime;
      combatTick = tick;
    },
    draw(
      actor: VisualActor,
      remotes: VisualActor[],
      time: number,
      reduced: boolean,
    ) {
      effectTime.value = reduced ? 0 : time;
      atmosphere.update(time, reduced, actor.position);
      butterflies.update(time, reduced, actor.position);
      combatView.update(currentSlime, combatTick, time, reduced);
      update(local, actor, time, reduced);
      const p = actor.position;
      camera.position.set(
        p.x,
        Math.sin(CAMERA_ELEVATION) * 40,
        p.y + Math.cos(CAMERA_ELEVATION) * 40,
      );
      camera.lookAt(p.x, 0, p.y);
      camera.updateMatrixWorld();
      actorFocus.set(p.x, 0.85, p.y);
      sun.position.set(p.x - 12, 24, p.y + 8);
      sun.target.position.set(p.x, 0, p.y);
      const rx = width / TILE_PIXELS / 2 + 10,
        ry = height / TILE_PIXELS / (2 * Math.sin(CAMERA_ELEVATION)) + 12;
      visibleProps = 0;
      for (const c of chunks) {
        const visible =
          Math.abs(c.center.x - p.x) < rx && Math.abs(c.center.y - p.y) < ry;
        for (const mesh of c.meshes) mesh.visible = visible;
        if (visible) visibleProps += c.meshes[2].count + c.meshes[3].count;
      }
      const ids = new Set(remotes.map((a) => a.id));
      for (const [id, peer] of peers)
        if (!ids.has(id)) {
          scene.remove(peer.model.root);
          peer.label.remove();
          peer.model.dispose();
          peers.delete(id);
        }
      for (const remote of remotes) {
        let peer = peers.get(remote.id);
        if (!peer) {
          const label = document.createElement("div");
          label.className = "world-name";
          labels.append(label);
          peer = { model: kit.character(remote.character), label };
          scene.add(peer.model.root);
          peers.set(remote.id, peer);
        }
        update(peer.model, remote, time, reduced);
        const screen = worldToScreen(remote.position, p, width, height);
        peer.label.textContent = `${remote.waving ? "✋ " : ""}${CHARACTERS[remote.character].mark} ${remote.name}${remote.health !== undefined && remote.health < 100 ? ` · ${remote.health} HP` : ""}`;
        peer.label.style.transform = `translate(${screen.x}px, ${screen.y - 62}px) translate(-50%, -100%)`;
        peer.label.style.color = CHARACTERS[remote.character].color;
        peer.label.hidden =
          screen.x < -100 ||
          screen.x > width + 100 ||
          screen.y < -100 ||
          screen.y > height + 100;
      }
      if (currentSlime) {
        const screen = worldToScreen(currentSlime.position, p, width, height);
        enemyLabel.textContent =
          currentSlime.health === 0
            ? "Slime defeated"
            : `Wild Slime · ${currentSlime.health}/30${currentSlime.phase === "tell" ? " · SLAM!" : ""}`;
        enemyLabel.style.transform = `translate(${screen.x}px, ${screen.y - 58}px) translate(-50%, -100%)`;
        enemyLabel.hidden =
          Math.hypot(
            currentSlime.position.x - p.x,
            currentSlime.position.y - p.y,
          ) > 12 ||
          (currentSlime.health === 0 &&
            combatTick - currentSlime.phaseTick > 180);
      } else enemyLabel.hidden = true;
      forestView.update(
        currentGate,
        combatTick,
        time,
        reduced,
        p,
        width,
        height,
      );
      mossView.update(
        moss,
        new Map([actor, ...remotes].map((a) => [a.id, a.name])),
        p,
        width,
        height,
        time,
        reduced,
        combatTick,
      );
      renderer.render(scene, camera);
    },
    workbenches: workbenchView.update,
    resources(depleted: string[], target?: { x: number; y: number }) {
      for (const id of depleted)
        if (!removed.has(id)) {
          removed.add(id);
          for (const entry of resourceInstances.get(id) ?? []) {
            entry.mesh.setMatrixAt(
              entry.index,
              new T.Matrix4().makeScale(0, 0, 0),
            );
            entry.mesh.instanceMatrix.needsUpdate = true;
          }
        }
      targetRing.visible = !!target;
      if (target) targetRing.position.set(target.x, 0.025, target.y);
    },
    environment: () => atmosphere.snapshot(),
    stats() {
      return {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      };
    },
    dispose() {
      for (const c of chunks) for (const mesh of c.meshes) mesh.dispose();
      targetRing.geometry.dispose();
      targetRing.material.dispose();
      geometry.dispose();
      material.dispose();
      leavesMaterial.dispose();
      waterMaterial.dispose();
      atmosphere.dispose();
      butterflies.dispose();
      combatView.dispose();
      workbenchView.dispose();
      mossView.dispose();
      forestView.dispose();
      kit.dispose();
      sun.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labels.remove();
      scene.clear();
      peers.clear();
    },
  };
}
