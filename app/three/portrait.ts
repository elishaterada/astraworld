import * as T from "three";
import type { CharacterId } from "../../packages/characters";
import { createModelKit, animateCharacter } from "./characters";
/** Render once into a 2D preview, releasing the temporary WebGL context immediately. */
export function drawPortrait(canvas: HTMLCanvasElement, id: CharacterId) {
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
  const kit = createModelKit();
  try {
    renderer.setSize(256, 320);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    const scene = new T.Scene(),
      camera = new T.OrthographicCamera(-0.8, 0.8, 1, -1, 0.1, 20);
    camera.position.set(2, 2.4, 5);
    camera.lookAt(0, 0.9, 0);
    scene.add(new T.HemisphereLight(0xf2f4e3, 0x697e74, 2.4));
    const sun = new T.DirectionalLight(0xffd8a3, 3);
    sun.position.set(-3, 6, 5);
    scene.add(sun);
    const model = kit.character(id);
    animateCharacter(model, 2, false, false, 0, true);
    scene.add(model.root);
    renderer.render(scene, camera);
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, 128, 160);
    context?.drawImage(renderer.domElement, 0, 0, 128, 160);
  } finally {
    kit.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
