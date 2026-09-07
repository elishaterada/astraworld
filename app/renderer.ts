import { generateWorld, SPAWN } from "../packages/world";
import {
  collides,
  interpolate,
  step,
  STEP_SECONDS,
  type Position,
} from "../packages/simulation";
import { createMeadowView } from "./three/view";
import { screenToWorld, worldToScreen } from "./camera";

import { DT, type RealtimeActor } from "../packages/protocol/realtime";
import { MeadowConnection } from "./network";
import { characterId, type CharacterId } from "../packages/characters";
import type { Session } from "../packages/protocol";

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
  connection?: string;
  players?: number;
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
  character: CharacterId;
  visual: { rotation: number; gait: number; waving: boolean };
  environment: {
    phase: number;
    ponds: number;
    bonfires: number;
    particles: number;
    activeLights: number;
  };
  renderer: {
    drawCalls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
  network?: {
    status: string;
    epoch: number;
    generation: number;
    owner: string;
    gateway: string;
    tick: number;
    selfId: string;
    authoritative: Position;
    facing: number;
    moving: boolean;
    action: RealtimeActor["action"];
    ack: number;
    sent: number;
    sentBytes: number;
    snapshotAge: number;
    correction: number;
    remotes: {
      id: string;
      name: string;
      character: CharacterId;
      visual?: { rotation: number; gait: number; waving: boolean };
      position: Position;
      facing: number;
      moving: boolean;
      action: RealtimeActor["action"];
    }[];
  };
};
declare global {
  interface Window {
    __MEADOW__?: { snapshot: () => DebugSnapshot };
  }
}

/** Owns all browser/Three.js state. The returned disposer is valid even during async init. */
export function mountMeadow(
  host: HTMLElement,
  seed: string,
  report: (s: SandboxReport) => void,
  fail: (message: string) => void,
  username: string,
  session?: Session,
  character: CharacterId = "fern",
): () => void {
  let disposed = false,
    cleanup: (() => void) | undefined;
  void (async () => {
    if (disposed) return;
    const world = generateWorld(seed);
    const view = createMeadowView(host, world, character);
    const blockerCount = world.tiles.filter((t) => t.blocker).length;
    let animationFrame = 0,
      lastFrame = performance.now(),
      deltaMS = 16.7,
      elapsedMS = 16.7;
    function stop() {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
    function start() {
      if (animationFrame) return;
      lastFrame = performance.now();
      animationFrame = requestAnimationFrame(loop);
    }
    function loop(now: number) {
      animationFrame = 0;
      elapsedMS = now - lastFrame;
      deltaMS = elapsedMS;
      lastFrame = now;
      tickFrame();
      if (!disposed && !document.hidden)
        animationFrame = requestAnimationFrame(loop);
    }
    let observer: ResizeObserver | undefined;
    const network = session ? new MeadowConnection(session) : null;
    const keys = new Set<string>();
    const removers: (() => void)[] = [];
    let tickerAttached = false;
    let debug: { snapshot: () => DebugSnapshot } | undefined;
    live.applications++;
    cleanup = () => {
      network?.dispose();
      observer?.disconnect();
      if (observer) live.observers--;
      for (const remove of removers) remove();
      if (tickerAttached) {
        live.tickers--;
      }
      stop();
      if (window.__MEADOW__ === debug) delete window.__MEADOW__;
      view.dispose();
      live.applications--;
    };
    let walkTime = 0,
      soloWaveUntil = 0;
    let facingIndex = 2;
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
        width: view.width,
        height: view.height,
        actorScreen: worldToScreen(rendered, camera, view.width, view.height),
        live: { ...live },
        frames: frames.slice(),
        blockerCount,
        visibleProps,
        seed: world.seed,
        username,
        character,
        visual: {
          rotation: view.local.root.rotation.y,
          gait: view.local.legs[0].rotation.x,
          waving: view.local.waving,
        },
        renderer: view.stats(),
        environment: view.environment(),
        ...(network
          ? {
              network: {
                status: network.status,
                epoch: network.epoch,
                generation: network.generation,
                owner: network.owner,
                gateway: network.gateway,
                tick: network.tick,
                selfId: network.session.playerId,
                authoritative: { ...network.authoritative },
                facing: network.actor.facing,
                moving: network.actor.moving,
                action: network.actor.action,
                ack: network.ack,
                sent: network.sent,
                sentBytes: network.sentBytes,
                snapshotAge: network.snapshotAge,
                correction: network.correction,
                remotes: network.remotes().map((a) => ({
                  id: a.id,
                  name: a.name,
                  character: characterId(a.character),
                  visual: view.peers.has(a.id)
                    ? {
                        rotation: view.peers.get(a.id)!.model.root.rotation.y,
                        gait: view.peers.get(a.id)!.model.legs[0].rotation.x,
                        waving: view.peers.get(a.id)!.model.waving,
                      }
                    : undefined,
                  position: { ...a.position },
                  facing: a.facing,
                  moving: a.moving,
                  action: a.action,
                })),
              },
            }
          : {}),
      }),
    };
    if (debugEnabled) window.__MEADOW__ = debug;
    const publish = () =>
      report({
        ...state,
        paused,
        fps: 1000 / Math.max(1, deltaMS),
        connection: network?.status,
        players: network ? network.remotes().length + 1 : 1,
      });
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
        if (!paused) {
          keys.add(e.code);
          const x =
            Number(keys.has("KeyD") || keys.has("ArrowRight")) -
            Number(keys.has("KeyA") || keys.has("ArrowLeft"));
          const y =
            Number(keys.has("KeyS") || keys.has("ArrowDown")) -
            Number(keys.has("KeyW") || keys.has("ArrowUp"));
          if (x || y)
            facingIndex =
              (Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8;
        }
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (!paused && !e.repeat) {
          if (network) network.wave();
          else soloWaveUntil = walkTime + 0.8;
        }
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
      if (document.hidden) stop();
      else start();
    });
    // This transform is shared with future targeting; M0 has no interaction commands.
    listen(host, "pointermove", ((e: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      const p = screenToWorld(
        {
          x: ((e.clientX - bounds.left) * view.width) / bounds.width,
          y: ((e.clientY - bounds.top) * view.height) / bounds.height,
        },
        camera,
        view.width,
        view.height,
      );
      if (!paused && Math.hypot(p.x - rendered.x, p.y - rendered.y) > 0.2)
        facingIndex =
          (Math.round(
            Math.atan2(p.y - rendered.y, p.x - rendered.x) / (Math.PI / 4),
          ) +
            8) %
          8;
      if (debugEnabled)
        host.dataset.pointerWorld = `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
    }) as EventListener);
    function draw() {
      rendered = network
        ? network.display(Math.min(deltaMS / 1000, 0.1))
        : interpolate(world, previous, state, accumulator / STEP_SECONDS);
      camera = rendered;
      const moving =
        !paused &&
        Math.abs(state.x - previous.x) + Math.abs(state.y - previous.y) >
          0.0001;
      const actor = network?.actor;
      view.draw(
        {
          id: session?.playerId ?? "solo",
          name: username,
          character,
          position: rendered,
          facing: actor?.facing ?? facingIndex,
          moving: actor?.moving ?? moving,
          waving: actor
            ? !!actor.action &&
              network!.tick +
                Math.max(0, actor.ack - network!.ack) -
                actor.action.startedTick <
                48
            : walkTime < soloWaveUntil,
        },
        (network?.remotes() ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          character: characterId(a.character),
          position: a.position,
          facing: a.facing,
          moving: a.moving,
          waving: !!a.action && network!.tick - a.action.startedTick < 48,
        })),
        walkTime,
        reducedMotion,
      );
      visibleProps = view.visibleProps;
    }
    function tickFrame() {
      const dt = Math.min(deltaMS / 1000, 0.25);
      if (!paused || network) {
        accumulator += dt;
        const fixed = network ? DT : STEP_SECONDS;
        while (accumulator + 1e-10 >= fixed) {
          previous = state;
          const input = {
            x:
              Number(!paused && (keys.has("KeyD") || keys.has("ArrowRight"))) -
              Number(!paused && (keys.has("KeyA") || keys.has("ArrowLeft"))),
            y:
              Number(!paused && (keys.has("KeyS") || keys.has("ArrowDown"))) -
              Number(!paused && (keys.has("KeyW") || keys.has("ArrowUp"))),
          };
          state = network
            ? network.advance(input, facingIndex)
            : step(world, state, input);
          accumulator = Math.max(0, accumulator - fixed);
          ticks++;
        }
      }
      if (!paused || network) walkTime += dt;
      elapsedFrames += dt;
      if (
        debugEnabled &&
        elapsedFrames > 2 &&
        !document.hidden &&
        frames.length < 40000
      )
        frames.push(elapsedMS);
      draw();
      elapsedUI += dt;
      if (elapsedUI >= 0.25) {
        elapsedUI = 0;
        publish();
      }
    }
    observer = new ResizeObserver(() => {
      view.resize();
      draw();
    });
    observer.observe(host);
    live.observers++;
    tickerAttached = true;
    live.tickers++;
    draw();
    start();
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
