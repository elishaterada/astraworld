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
): () => void {
  let disposed = false,
    cleanup: (() => void) | undefined;
  void (async () => {
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
    const texture = (g: Graphics) => {
      const t = app.renderer.generateTexture({ target: g, resolution: 1 });
      t.source.scaleMode = "nearest";
      textures.push(t);
      live.textures++;
      g.destroy();
      return t;
    };
    const chunks: { sprite: Sprite; x: number; y: number }[] = [];
    for (let cy = 0; cy < SIZE / CHUNK_SIZE; cy++)
      for (let cx = 0; cx < SIZE / CHUNK_SIZE; cx++) {
        const g = new Graphics();
        for (let ly = 0; ly < CHUNK_SIZE; ly++)
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            const t =
              world.tiles[(cy * CHUNK_SIZE + ly) * SIZE + cx * CHUNK_SIZE + lx];
            const grass = [0x92ad68, 0x94af6a, 0x91ab66, 0x96af6b];
            const sand = [0xc5bc88, 0xc8bf8e, 0xc7be8d, 0xc3b984];
            g.rect(lx * 32, ly * 32, 32, 32).fill(
              (t.terrain === "grass" ? grass : sand)[t.variant % 4],
            );
            if (t.terrain === "grass") {
              g.rect(lx * 32 + 7 + t.variant, ly * 32 + 10, 2, 5).fill(
                0x799859,
              );
              g.rect(lx * 32 + 11 + t.variant, ly * 32 + 8, 2, 4).fill(
                0x799859,
              );
              if (t.variant === 1 && !t.blocker)
                g.rect(lx * 32 + 23, ly * 32 + 23, 3, 3).fill(0xf6e6a9);
              if (t.variant === 6 && !t.blocker)
                g.rect(lx * 32 + 22, ly * 32 + 18, 3, 3).fill(0xd5dae3);
            } else
              g.rect(lx * 32 + 6 + t.variant * 2, ly * 32 + 22, 2, 2).fill(
                0xb2aa7c,
              );
          }
        const sprite = new Sprite(texture(g));
        sprite.position.set(cx * 512, cy * 512);
        ground.addChild(sprite);
        chunks.push({ sprite, x: cx * 16, y: cy * 16 });
      }
    const tree = texture(
      new Graphics()
        .ellipse(24, 52, 19, 8)
        .fill({ color: 0x334b35, alpha: 0.25 })
        .rect(19, 31, 10, 22)
        .fill(0x725839)
        .rect(23, 35, 4, 16)
        .fill(0x987447)
        .poly([
          3, 31, 4, 17, 13, 17, 13, 7, 22, 7, 22, 2, 33, 2, 33, 10, 42, 10, 42,
          19, 47, 19, 47, 35, 36, 35, 36, 41, 14, 41, 14, 36, 3, 36,
        ])
        .fill(0x355b3b)
        .rect(9, 17, 28, 15)
        .fill(0x4d7948)
        .rect(17, 9, 15, 18)
        .fill(0x628952)
        .rect(13, 17, 9, 7)
        .fill(0x799a5d),
    );
    const rock = texture(
      new Graphics()
        .ellipse(18, 27, 18, 6)
        .fill({ color: 0x334b35, alpha: 0.2 })
        .poly([1, 23, 6, 8, 15, 2, 28, 5, 34, 17, 34, 27, 8, 29])
        .fill(0x69756b)
        .poly([5, 19, 9, 9, 17, 5, 27, 8, 30, 18, 17, 21])
        .fill(0x9fa997)
        .poly([9, 10, 17, 5, 26, 8, 18, 11])
        .fill(0xbdc4ae),
    );
    const props: { sprite: Sprite; tile: Tile }[] = [];
    for (const tile of world.tiles)
      if (tile.blocker) {
        const sprite = new Sprite(tile.blocker === "tree" ? tree : rock);
        sprite.anchor.set(0.5, 0.9);
        sprite.position.set((tile.x + 0.5) * 32, (tile.y + 0.85) * 32);
        sprite.zIndex = tile.y + 0.85;
        objects.addChild(sprite);
        props.push({ sprite, tile });
      }
    const marker = new Graphics()
      .ellipse(0, 0, 19, 9)
      .stroke({ color: 0xf9efd0, width: 2, alpha: 0.75 });
    marker.position.set(SPAWN.x * 32, SPAWN.y * 32);
    ground.addChild(marker);
    const avatar = new Container();
    const shadow = new Graphics()
      .ellipse(0, 0, 10, 4)
      .fill({ color: 0x354b38, alpha: 0.35 });
    const body = new Graphics()
      .rect(-7, -9, 5, 10)
      .fill(0x36493f)
      .rect(2, -9, 5, 10)
      .fill(0x36493f)
      .rect(-9, -22, 18, 15)
      .fill(0xe5c276)
      .rect(-9, -20, 5, 12)
      .fill(0xf5dfa5)
      .rect(-7, -33, 14, 14)
      .fill(0xf1c598)
      .rect(-8, -34, 16, 7)
      .fill(0x5d4535)
      .rect(-12, -30, 24, 4)
      .fill(0x8d5d3e)
      .rect(-7, -38, 14, 9)
      .fill(0xb17e4f)
      .rect(3, -25, 2, 2)
      .fill(0x36493f)
      .rect(-10, -18, 4, 8)
      .fill(0xbb694b);
    avatar.addChild(shadow, body);
    objects.addChild(avatar);
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
      const rx = app.screen.width / 64 + 2,
        ry = app.screen.height / 64 + 3;
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
          Math.abs(p.tile.x + 0.5 - rendered.x) < 0.85 &&
          rendered.y < p.tile.y + 0.8 &&
          rendered.y > p.tile.y - 1.2
            ? 0.45
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
