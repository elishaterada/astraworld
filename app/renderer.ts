import {
  Application,
  Container,
  Graphics,
  Sprite,
  type Texture,
} from "pixi.js";
import {
  generateWorld,
  SIZE,
  CHUNK_SIZE,
  SPAWN,
  type Tile,
} from "../packages/world";
import {
  collides,
  interpolate,
  step,
  STEP_SECONDS,
  type Position,
} from "../packages/simulation";
import { loadMeadowArt, terrainTexture } from "./art";
import { screenToWorld, TILE_PIXELS, worldToScreen } from "./camera";

const live = {
  applications: 0,
  inputListeners: 0,
  tickers: 0,
  observers: 0,
  textures: 0,
};
export type SandboxReport = {
  x: number;
  y: number;
  paused: boolean;
  fps: number;
};
export type DebugSnapshot = {
  state: Position;
  rendered: Position;
  camera: Position;
  tick: number;
  paused: boolean;
  collision: boolean;
  width: number;
  height: number;
  actorScreen: Position;
  live: typeof live;
  frames: number[];
  blockerCount: number;
  visibleProps: number;
  seed: string;
  username: string;
  sharedAtlasFrames: number;
};
declare global {
  interface Window {
    __MEADOW__?: { snapshot: () => DebugSnapshot };
  }
}

/** Owns all browser/Pixi state. The returned disposer is valid even during async init. */
export function mountMeadow(
  host: HTMLElement,
  seed: string,
  report: (s: SandboxReport) => void,
  fail: (message: string) => void,
  username: string,
): () => void {
  let disposed = false,
    cleanup: (() => void) | undefined;
  void (async () => {
    const art = await loadMeadowArt();
    if (disposed) return;
    const app = new Application();
    await app.init({
      width: host.clientWidth,
      height: host.clientHeight,
      background: "#54634a",
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      autoStart: false,
      preference: "webgl",
    });
    if (disposed) {
      app.destroy(true, { children: true });
      return;
    }
    const textures: Texture[] = [];
    let observer: ResizeObserver | undefined;
    const keys = new Set<string>();
    const removers: (() => void)[] = [];
    let tickerAttached = false;
    let debug: { snapshot: () => DebugSnapshot } | undefined;
    live.applications++;
    cleanup = () => {
      observer?.disconnect();
      if (observer) live.observers--;
      for (const remove of removers) remove();
      if (tickerAttached) {
        app.ticker.remove(tickFrame);
        live.tickers--;
      }
      app.stop();
      if (window.__MEADOW__ === debug) delete window.__MEADOW__;
      app.destroy(true, { children: true });
      for (const texture of textures) texture.destroy(true);
      live.textures -= textures.length;
      live.applications--;
    };
    const world = generateWorld(seed);
    const root = new Container(),
      ground = new Container(),
      objects = new Container();
    objects.sortableChildren = true;
    root.addChild(ground, objects);
    app.stage.addChild(root);
    const chunks: { sprite: Sprite; x: number; y: number }[] = [];
    for (let cy = 0; cy < SIZE / CHUNK_SIZE; cy++)
      for (let cx = 0; cx < SIZE / CHUNK_SIZE; cx++) {
        const texture = terrainTexture(world, cx, cy);
        textures.push(texture);
        live.textures++;
        const sprite = new Sprite(texture);
        sprite.width = sprite.height = 512;
        sprite.position.set(cx * 512, cy * 512);
        ground.addChild(sprite);
        chunks.push({ sprite, x: cx * 16, y: cy * 16 });
      }
    const props: { sprite: Sprite; tile: Tile }[] = [];
    const flowers: { sprite: Sprite; tile: Tile }[] = [];
    for (const tile of world.tiles) {
      if (tile.blocker) {
        const sprite = new Sprite(
          art[
            tile.blocker === "tree" ? tile.variant % 4 : 4 + (tile.variant % 2)
          ],
        );
        sprite.anchor.set(0.5, 0.95);
        const scale =
          tile.blocker === "tree"
            ? (100 + tile.variant * 2) / sprite.texture.height
            : 39 / sprite.texture.height;
        sprite.scale.set(scale);
        sprite.position.set((tile.x + 0.5) * 32, (tile.y + 0.85) * 32);
        sprite.zIndex = tile.y + 0.85;
        objects.addChild(sprite);
        props.push({ sprite, tile });
      } else if (
        tile.terrain === "grass" &&
        (tile.variant === 1 || tile.variant === 6) &&
        (tile.x + tile.y) % 4 === 0
      ) {
        const sprite = new Sprite(art[6 + (tile.variant % 2)]);
        sprite.anchor.set(0.5, 1);
        sprite.scale.set(15 / sprite.texture.height);
        sprite.position.set((tile.x + 0.4) * 32, (tile.y + 0.8) * 32);
        ground.addChild(sprite);
        flowers.push({ sprite, tile });
      }
    }
    const avatar = new Container();
    const shadow = new Graphics()
      .ellipse(0, 0, 10, 4)
      .fill({ color: 0x193d30, alpha: 0.3 });
    const body = new Sprite(art[8]);
    body.anchor.set(0.5, 1);
    body.scale.set(48 / body.texture.height);
    avatar.addChild(shadow, body);
    objects.addChild(avatar);
    let facing: "down" | "up" | "right" | "left" = "down",
      walkTime = 0;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let state: Position = { ...SPAWN },
      previous = state,
      rendered = state;
    let accumulator = 0,
      ticks = 0,
      paused = true,
      elapsedUI = 0,
      elapsedFrames = 0;
    let camera = state,
      visibleProps = 0;
    const frames: number[] = [];
    const debugEnabled =
      new URLSearchParams(location.search).get("debug") === "1";
    debug = {
      snapshot: (): DebugSnapshot => ({
        state: { ...state },
        rendered: { ...rendered },
        camera: { ...camera },
        tick: ticks,
        paused,
        collision: collides(world, state),
        width: app.screen.width,
        height: app.screen.height,
        actorScreen: worldToScreen(
          rendered,
          camera,
          app.screen.width,
          app.screen.height,
        ),
        live: { ...live },
        frames: frames.slice(),
        blockerCount: props.length,
        visibleProps,
        seed: world.seed,
        username,
        sharedAtlasFrames: art.length,
      }),
    };
    if (debugEnabled) window.__MEADOW__ = debug;
    const publish = () => report({ ...state, paused, fps: app.ticker.FPS });
    const pause = () => {
      keys.clear();
      paused = true;
      accumulator = 0;
      previous = state;
      rendered = state;
      publish();
    };
    const resume = () => {
      if (!document.hidden) {
        paused = false;
        publish();
      }
    };
    const movementCodes = new Set([
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowLeft",
      "ArrowDown",
      "ArrowRight",
    ]);
    function listen(target: EventTarget, name: string, fn: EventListener) {
      target.addEventListener(name, fn);
      live.inputListeners++;
      removers.push(() => {
        target.removeEventListener(name, fn);
        live.inputListeners--;
      });
    }
    listen(host, "keydown", ((e: KeyboardEvent) => {
      if (movementCodes.has(e.code)) {
        e.preventDefault();
        if (!paused) keys.add(e.code);
      }
      if (e.code === "Escape") {
        e.preventDefault();
        pause();
        host.blur();
      }
    }) as EventListener);
    listen(host, "keyup", ((e: KeyboardEvent) => {
      if (movementCodes.has(e.code)) {
        e.preventDefault();
        keys.delete(e.code);
      }
    }) as EventListener);
    listen(host, "pointerdown", () => {
      host.focus();
      resume();
    });
    listen(host, "focus", resume);
    listen(host, "blur", pause);
    listen(window, "blur", pause);
    listen(document, "fullscreenchange", () => {
      if (!document.fullscreenElement) pause();
    });
    listen(document, "visibilitychange", () => {
      pause();
      if (document.hidden) app.stop();
      else app.start();
    });
    // This transform is shared with future targeting; M0 has no interaction commands.
    listen(host, "pointermove", ((e: PointerEvent) => {
      if (!debugEnabled) return;
      const bounds = host.getBoundingClientRect();
      const p = screenToWorld(
        {
          x: ((e.clientX - bounds.left) * app.screen.width) / bounds.width,
          y: ((e.clientY - bounds.top) * app.screen.height) / bounds.height,
        },
        camera,
        app.screen.width,
        app.screen.height,
      );
      host.dataset.pointerWorld = `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
    }) as EventListener);
    function draw() {
      const alpha = accumulator / STEP_SECONDS;
      rendered = interpolate(world, previous, state, alpha);
      camera = rendered;
      root.position.set(
        app.screen.width / 2 - camera.x * TILE_PIXELS,
        app.screen.height / 2 - camera.y * TILE_PIXELS,
      );
      avatar.position.set(rendered.x * 32, rendered.y * 32);
      avatar.zIndex = rendered.y;
      const moving =
        !paused &&
        Math.abs(state.x - previous.x) + Math.abs(state.y - previous.y) >
          0.0001;
      if (moving) {
        const dx = state.x - previous.x,
          dy = state.y - previous.y;
        facing =
          Math.abs(dx) > Math.abs(dy)
            ? dx > 0
              ? "right"
              : "left"
            : dy > 0
              ? "down"
              : "up";
      }
      const frame = moving && !reducedMotion ? Math.floor(walkTime * 8) % 4 : 0;
      const gait = [0, 1, 0, 2][frame];
      const index =
        facing === "up"
          ? gait
            ? 15
            : 11
          : facing === "down"
            ? 8 + gait
            : 12 + gait;
      body.texture = art[index];
      body.scale.set(
        ((facing === "left" ? -1 : 1) * 48) / art[8].height,
        48 / art[8].height,
      );
      const rx = app.screen.width / 64 + 4,
        ry = app.screen.height / 64 + 5;
      for (const f of flowers)
        f.sprite.visible =
          Math.abs(f.tile.x - camera.x) < rx &&
          Math.abs(f.tile.y - camera.y) < ry;
      for (const c of chunks)
        c.sprite.visible =
          c.x < camera.x + rx &&
          c.x + 16 > camera.x - rx &&
          c.y < camera.y + ry &&
          c.y + 16 > camera.y - ry;
      visibleProps = 0;
      for (const p of props) {
        p.sprite.visible =
          Math.abs(p.tile.x - camera.x) < rx &&
          Math.abs(p.tile.y - camera.y) < ry;
        if (p.sprite.visible) visibleProps++;
        p.sprite.alpha =
          p.tile.blocker === "tree" &&
          Math.abs(p.tile.x + 0.5 - rendered.x) < 1.5 &&
          rendered.y < p.tile.y + 0.8 &&
          rendered.y > p.tile.y - 2.5
            ? 0.22
            : 1;
      }
    }
    function tickFrame() {
      const dt = Math.min(app.ticker.deltaMS / 1000, 0.25);
      if (!paused) {
        accumulator += dt;
        while (accumulator + 1e-10 >= STEP_SECONDS) {
          previous = state;
          state = step(world, state, {
            x:
              Number(keys.has("KeyD") || keys.has("ArrowRight")) -
              Number(keys.has("KeyA") || keys.has("ArrowLeft")),
            y:
              Number(keys.has("KeyS") || keys.has("ArrowDown")) -
              Number(keys.has("KeyW") || keys.has("ArrowUp")),
          });
          accumulator = Math.max(0, accumulator - STEP_SECONDS);
          ticks++;
        }
      }
      if (!paused) walkTime += dt;
      elapsedFrames += dt;
      if (
        debugEnabled &&
        elapsedFrames > 2 &&
        !document.hidden &&
        frames.length < 40000
      )
        frames.push(app.ticker.elapsedMS);
      draw();
      elapsedUI += dt;
      if (elapsedUI >= 0.25) {
        elapsedUI = 0;
        publish();
      }
    }
    observer = new ResizeObserver(() => {
      app.renderer.resize(
        Math.max(1, host.clientWidth),
        Math.max(1, host.clientHeight),
      );
      draw();
    });
    observer.observe(host);
    live.observers++;
    app.canvas.setAttribute("aria-hidden", "true");
    host.appendChild(app.canvas);
    app.ticker.add(tickFrame);
    tickerAttached = true;
    live.tickers++;
    draw();
    app.start();
    publish();
    host.focus();
  })().catch((error) => {
    cleanup?.();
    cleanup = undefined;
    if (!disposed)
      fail(error instanceof Error ? error.message : "Renderer could not start");
  });
  return () => {
    disposed = true;
    cleanup?.();
    cleanup = undefined;
  };
}
