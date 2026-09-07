import * as T from "three";
import { type World, SIZE, CHUNK_SIZE } from "../../packages/world";
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
};
type Cube = {
  position: [number, number, number];
  scale: [number, number, number];
  color: number;
  rotation?: number;
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
  renderer.toneMappingExposure = 1.1;
  const scene = new T.Scene();
  scene.background = new T.Color(0x354e46);
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 160);
  const sky = new T.HemisphereLight(0xe5f3e0, 0x526245, 1.5);
  scene.add(sky);
  const sun = new T.DirectionalLight(0xffdfab, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
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
    shader.uniforms.actorFocus = { value: actorFocus };
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      "#include <common>\nvarying vec3 meadowPosition;",
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\nmeadowPosition = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;",
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
  const chunks: { center: Position; meshes: T.InstancedMesh[] }[] = [];
  const dummy = new T.Object3D(),
    color = new T.Color();
  function batch(cubes: Cube[], m: T.Material, shadow: boolean) {
    const mesh = new T.InstancedMesh(geometry, m, cubes.length);
    for (let i = 0; i < cubes.length; i++) {
      const c = cubes[i];
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
  const grass = [
    0x739653, 0x7b9b57, 0x719250, 0x799652, 0x759850, 0x809b59, 0x729551,
    0x7b9a55,
  ];
  const path = [
    0xb79e68, 0xbba36e, 0xb99e6b, 0xc0a973, 0xbca36c, 0xb9a16c, 0xc2aa76,
    0xbda570,
  ];
  for (let cy = 0; cy < SIZE / CHUNK_SIZE; cy++)
    for (let cx = 0; cx < SIZE / CHUNK_SIZE; cx++) {
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
            -0.22,
            pz,
            1,
            0.44,
            1,
            (t.terrain === "grass" ? grass : path)[v],
          );
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
              t.terrain === "grass" ? 0x90ab62 : 0xcbb77f,
            );
          if (t.blocker === "tree") {
            // The mossy plinth communicates the exact full-tile solid footprint.
            add(props, px, 0.09, pz, 0.98, 0.18, 0.98, 0x596f47);
            add(props, px, 0.73, pz, 0.39, 1.32, 0.38, 0x705036);
            add(props, px - 0.07, 0.78, pz + 0.2, 0.1, 1.2, 0.045, 0x977049);
            const h = 1.65 + v * 0.07;
            add(leaves, px, h, pz, 1.5, 0.64, 1.36, 0x496e3b, v * 0.12);
            add(
              leaves,
              px - 0.17,
              h + 0.46,
              pz - 0.09,
              1.17,
              0.55,
              1.14,
              0x638842,
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
              0x81a64d,
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
              0x587c3e,
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
                0x779a49,
                0.2,
              );
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
          } else if (t.terrain === "grass" && (x + y) % 3 === 0) {
            add(props, x + 0.23, 0.13, y + 0.22, 0.04, 0.26, 0.05, 0x526d3e);
            add(
              props,
              x + 0.34,
              0.1,
              y + 0.24,
              0.045,
              0.2,
              0.04,
              0x617f42,
              -0.2,
            );
            if (v === 1 || v === 6) {
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
          batch(props, material, true),
          batch(leaves, leavesMaterial, true),
        ],
      });
    }
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
      actor.facing,
      actor.moving,
      actor.waving,
      time,
      reduced,
    );
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
    draw(
      actor: VisualActor,
      remotes: VisualActor[],
      time: number,
      reduced: boolean,
    ) {
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
        if (visible) visibleProps += c.meshes[1].count + c.meshes[2].count;
      }
      const ids = new Set(remotes.map((a) => a.id));
      for (const [id, peer] of peers)
        if (!ids.has(id)) {
          scene.remove(peer.model.root);
          peer.label.remove();
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
        peer.label.textContent = `${remote.waving ? "✋ " : ""}${CHARACTERS[remote.character].mark} ${remote.name}`;
        peer.label.style.transform = `translate(${screen.x}px, ${screen.y - 62}px) translate(-50%, -100%)`;
        peer.label.style.color = CHARACTERS[remote.character].color;
        peer.label.hidden =
          screen.x < -100 ||
          screen.x > width + 100 ||
          screen.y < -100 ||
          screen.y > height + 100;
      }
      renderer.render(scene, camera);
    },
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
      geometry.dispose();
      material.dispose();
      leavesMaterial.dispose();
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
