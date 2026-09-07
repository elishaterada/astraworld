import * as T from "three";
import { meadowLandmarks } from "../../packages/world/landmarks";
import { seedHash, type World } from "../../packages/world";
import type { Position } from "../../packages/simulation";

/** Bounded, cosmetic effects only. No collision or game-state mutation. */
export function createAtmosphere(scene: T.Scene, world: World) {
  const landmarks = meadowLandmarks(seedHash(world.seed));
  const root = new T.Group();
  scene.add(root);
  const geometry = new T.BoxGeometry(1, 1, 1);
  const amber = new T.MeshBasicMaterial({ color: 0xffb83b, toneMapped: false });
  const hot = new T.MeshBasicMaterial({ color: 0xffef9b, toneMapped: false });
  const smokeMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { time: { value: 0 } },
    vertexShader:
      "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `varying vec2 vUv;uniform float time;void main(){vec2 p=vUv-.5;float d=length(p*vec2(1.0,1.4));float edge=1.0-smoothstep(.1,.5,d);float wisps=.65+.35*sin(vUv.x*21.+vUv.y*11.+time*.3);gl_FragColor=vec4(.62,.73,.72,edge*wisps*.15);}`,
  });
  const mistGeometry = new T.PlaneGeometry(1, 1);
  const mists: T.Mesh[] = [];
  for (const pond of landmarks.ponds)
    for (let i = 0; i < 3; i++) {
      const mist = new T.Mesh(mistGeometry, smokeMaterial);
      mist.rotation.x = -Math.PI / 2;
      mist.position.set(pond.x + (i - 1) * 2, 0.55 + i * 0.22, pond.y);
      mist.scale.set(pond.rx * 2, pond.ry * 1.5, 1);
      root.add(mist);
      mists.push(mist);
    }
  const glowMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    vertexShader:
      "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:
      "varying vec2 vUv;void main(){float a=pow(max(0.,1.-length(vUv-.5)*2.),3.);gl_FragColor=vec4(1.,.38,.04,a*.42);}",
  });
  const fires = landmarks.fires.map((p) => {
    const group = new T.Group();
    group.position.set(p.x + 0.5, 0, p.y + 0.5);
    root.add(group);
    const flames: T.Mesh[] = [];
    for (let i = 0; i < 7; i++) {
      const mesh = new T.Mesh(geometry, i % 2 ? hot : amber);
      mesh.position.set(
        Math.sin(i * 2.4) * 0.22,
        0.55 + i * 0.07,
        Math.cos(i * 2.4) * 0.19,
      );
      mesh.scale.set(0.17, 0.35, 0.17);
      group.add(mesh);
      flames.push(mesh);
    }
    const glow = new T.Mesh(mistGeometry, glowMaterial);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.025;
    glow.scale.set(6, 6, 1);
    group.add(glow);
    return { group, flames, p };
  });
  // Fixed light pool avoids shader recompilation as camps enter or leave the view.
  const lights = Array.from({ length: 2 }, (_, i) => {
    const light = new T.PointLight(0xffa344, 0, 8, 2);
    light.castShadow = i === 0;
    light.shadow.mapSize.set(256, 256);
    light.shadow.camera.near = 0.15;
    light.shadow.camera.far = 8;
    light.shadow.normalBias = 0.035;
    light.shadow.autoUpdate = false;
    scene.add(light);
    return light;
  });
  const particleGeometry = new T.BufferGeometry();
  const count = 160,
    positions = new Float32Array(count * 3),
    colors = new Float32Array(count * 3),
    sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const c = new T.Color(i < 64 ? 0xffc56b : 0xd4e5a0);
    colors.set(c.toArray(), i * 3);
    sizes[i] = i < 64 ? 4 : 2;
  }
  particleGeometry.setAttribute(
    "position",
    new T.BufferAttribute(positions, 3),
  );
  particleGeometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  particleGeometry.setAttribute("size", new T.BufferAttribute(sizes, 1));
  const particleMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: T.AdditiveBlending,
    vertexShader:
      "attribute float size;varying vec3 vColor;void main(){vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size;}",
    fragmentShader:
      "varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(.1,.5,d);gl_FragColor=vec4(vColor,a*.8);}",
  });
  const particles = new T.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  root.add(particles);
  const smoke = landmarks.fires.map((p) => {
    const mesh = new T.Mesh(mistGeometry, smokeMaterial);
    mesh.position.set(p.x + 0.5, 2.1, p.y + 0.5);
    mesh.scale.set(1.8, 2.8, 1);
    mesh.rotation.x = -0.35;
    root.add(mesh);
    return mesh;
  });
  let phase = 0,
    shadowAt = -1;
  return {
    update(time: number, reduced: boolean, p: Position) {
      phase = reduced ? 0 : time;
      smokeMaterial.uniforms.time.value = phase;
      for (let i = 0; i < mists.length; i++) {
        const pond = landmarks.ponds[Math.floor(i / 3)];
        mists[i].position.x =
          pond.x + ((i % 3) - 1) * 2 + Math.sin(phase * 0.12 + i) * 0.8;
      }
      for (const fire of fires) {
        fire.group.visible = Math.hypot(fire.p.x - p.x, fire.p.y - p.y) < 35;
        for (let i = 0; i < fire.flames.length; i++) {
          const f = fire.flames[i];
          f.scale.y = 0.28 + (Math.sin(phase * 8 + i * 3) + 1) * 0.16;
          f.rotation.y = phase * 0.3 + i;
          f.position.y = 0.43 + i * 0.075 + Math.sin(phase * 5 + i) * 0.06;
        }
      }
      const nearby = landmarks.fires.toSorted(
        (a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
      );
      if (time - shadowAt >= 0.05) {
        lights[0].shadow.needsUpdate = true;
        shadowAt = time;
      }
      for (let i = 0; i < lights.length; i++) {
        const fire = nearby[i];
        lights[i].position.set(fire.x + 0.5, 2.0, fire.y + 0.5);
        lights[i].intensity =
          Math.hypot(fire.x - p.x, fire.y - p.y) < 30
            ? 9 +
              (reduced
                ? 0
                : Math.sin(phase * 9 + i) * 0.7 + Math.sin(phase * 13) * 0.35)
            : 0;
      }
      for (let i = 0; i < count; i++) {
        if (i < 64) {
          const fire = landmarks.fires[Math.floor(i / 16)],
            age = (phase * 0.24 + i * 0.173) % 1;
          positions[i * 3] = fire.x + 0.5 + Math.sin(i * 13) * age * 0.9;
          positions[i * 3 + 1] = 0.55 + age * 2.5;
          positions[i * 3 + 2] = fire.y + 0.5 + Math.cos(i * 8) * age * 0.6;
        } else {
          const n = i - 64;
          positions[i * 3] =
            64 +
            Math.sin(n * 27.1) * 18 +
            Math.round((p.x - 64 - Math.sin(n * 27.1) * 18) / 40) * 40 +
            Math.sin(phase * 0.15 + n) * 0.5;
          positions[i * 3 + 1] = 0.4 + (Math.sin(n * 8) + 1) * 0.9;
          positions[i * 3 + 2] =
            64 +
            Math.cos(n * 17.3) * 18 +
            Math.round((p.y - 64 - Math.cos(n * 17.3) * 18) / 40) * 40 +
            Math.cos(phase * 0.2 + n) * 0.4;
        }
      }
      particleGeometry.attributes.position.needsUpdate = true;
      for (let i = 0; i < smoke.length; i++) {
        smoke[i].position.x =
          landmarks.fires[i].x + 0.5 + Math.sin(phase * 0.4 + i) * 0.25;
        smoke[i].visible = fires[i].group.visible;
      }
    },
    snapshot() {
      return {
        phase,
        ponds: landmarks.ponds.length,
        bonfires: fires.length,
        particles: count,
        activeLights: lights.filter((l) => l.intensity > 0).length,
        fireShadowLights: lights.filter((l) => l.castShadow && l.intensity > 0)
          .length,
      };
    },
    dispose() {
      root.removeFromParent();
      for (const light of lights) {
        light.shadow.dispose();
        light.removeFromParent();
      }
      geometry.dispose();
      mistGeometry.dispose();
      amber.dispose();
      hot.dispose();
      smokeMaterial.dispose();
      glowMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      root.clear();
    },
  };
}
