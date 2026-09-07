import type { Gate } from "../packages/protocol/utility";
import { VINE_TARGET, inForest } from "../packages/world/forest";
import type {
  Moss,
  CompanionReceipt,
  CompanionCommand,
} from "../packages/protocol/taming";
import type { CombatState, Slime } from "../packages/protocol/combat";
import { resourceNodes } from "../packages/world/resources";
import { freshProgress, type Progress } from "../packages/content";
import { emptyGathering, gather } from "../packages/simulation/gathering";
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
  gate?: Gate;
  nearGate?: boolean;
  forest?: boolean;
  mossTarget?: Moss;
  companion?: Moss;
  companionReceipt?: CompanionReceipt;
  health?: number;
  slimeHealth?: number;
  x: number;
  y: number;
  paused: boolean;
  fps: number;
  connection?: string;
  players?: number;
  progress?: Progress;
  target?: string;
  gathering?: boolean;
};
export type DebugSnapshot = {
  gate?: Gate;
  moss: Moss[];
  companionReceipt?: CompanionReceipt;
  combat?: CombatState;
  slime?: Slime;
  progress?: Progress;
  depleted: string[];
  target?: { id: string; kind: string; x: number; y: number };
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
  visual: {
    rotation: number;
    gait: number;
    waving: boolean;
    attacking: boolean;
  };
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
      combat?: CombatState;
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
    let world = generateWorld(seed);
    const nodes = resourceNodes(world),
      nodeMap = new Map(nodes.map((n) => [n.id, n]));
    let soloGathering = emptyGathering();
    soloGathering.players.solo = freshProgress();
    let gatherUntil = 0,
      gatherKind = "";
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
    const progress = () =>
      network ? network.progress : soloGathering.players.solo;
    const depleted = () =>
      network ? network.depleted : soloGathering.depleted;
    const nearest = () => {
      const gone = new Set(depleted());
      return nodes
        .filter(
          (n) =>
            !gone.has(n.id) && Math.hypot(n.x - state.x, n.y - state.y) <= 1.5,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - state.x, a.y - state.y) -
            Math.hypot(b.x - state.x, b.y - state.y),
        )[0];
    };
    const owned = () =>
      network?.moss.find((m) => m.owner === session?.playerId);
    const mossTarget = () =>
      network?.moss
        .filter(
          (m) =>
            !m.owner &&
            Math.hypot(m.position.x - state.x, m.position.y - state.y) <= 1.5,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.position.x - state.x, a.position.y - state.y) -
            Math.hypot(b.position.x - state.x, b.position.y - state.y),
        )[0];
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
        gate: network?.gate,
        moss: structuredClone(network?.moss ?? []),
        companionReceipt: network?.companionReceipt,
        combat: network?.actor.combat
          ? structuredClone(network.actor.combat)
          : undefined,
        slime: network?.slime ? structuredClone(network.slime) : undefined,
        progress: progress() ? structuredClone(progress()) : undefined,
        depleted: [...depleted()],
        target: nearest(),
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
          attacking: view.local.blade.visible,
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
                  combat: a.combat,
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
        progress: progress(),
        target: nearest()?.kind,
        gathering: network?.gathering,
        health: network?.actor.combat?.health,
        slimeHealth: network?.slime?.health,
        gate: network?.gate,
        nearGate:
          Math.hypot(state.x - VINE_TARGET.x, state.y - VINE_TARGET.y) < 4,
        forest: inForest(state.x, state.y),
        mossTarget: mossTarget(),
        companion: owned(),
        companionReceipt: network?.companionReceipt,
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
      if (
        e.code === "KeyJ" ||
        e.code === "ShiftLeft" ||
        e.code === "ShiftRight"
      ) {
        e.preventDefault();
        if (!paused && !e.repeat) {
          if (e.code === "KeyJ") network?.attack();
          else network?.dodge();
        }
      }
      if (e.code === "KeyQ" && !paused && !e.repeat && network?.gate) {
        e.preventDefault();
        network.companion("dissolve", network.gate.id);
      }
      if ((e.code === "KeyC" || e.code === "KeyR") && !paused && !e.repeat) {
        e.preventDefault();
        const m = owned();
        if (m)
          network?.companion(
            e.code === "KeyR"
              ? "recall"
              : m.mode === "stay"
                ? "follow"
                : "stay",
            m.id,
          );
      }
      if (e.code === "KeyE") {
        const moss = mossTarget();
        if (moss && !paused && !e.repeat) {
          e.preventDefault();
          network?.companion("feed", moss.id);
          return;
        }

        e.preventDefault();
        const target = nearest();
        if (!paused && !e.repeat && target) {
          facingIndex =
            (Math.round(
              Math.atan2(target.y - state.y, target.x - state.x) /
                (Math.PI / 4),
            ) +
              8) %
            8;
          if (network ? network.gather(target.id) : true) {
            gatherUntil = walkTime + 0.5;
            gatherKind = target.kind;
          }
          if (!network)
            soloGathering = gather(
              world,
              nodeMap,
              soloGathering,
              "solo",
              state,
              { seq: (progress()?.receipt?.seq ?? 0) + 1, target: target.id },
              ticks * 3,
            );
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
    listen(host, "pointerdown", ((e: PointerEvent) => {
      const wasPaused = paused;
      host.focus();
      resume();
      if (!wasPaused && e.button === 0) network?.attack();
    }) as EventListener);
    listen(host, "companion-command", ((
      e: CustomEvent<CompanionCommand["action"]>,
    ) => {
      const m = owned();
      if (m) network?.companion(e.detail, m.id);
    }) as EventListener);
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
    // Pointer facing uses the same ground-plane transform as rendering.
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
      world = { ...world, gateOpen: network?.gate?.open ?? false };
      view.gate(network?.gate);
      rendered = network
        ? network.display(Math.min(deltaMS / 1000, 0.1))
        : interpolate(world, previous, state, accumulator / STEP_SECONDS);
      camera = rendered;
      const moving =
        !paused &&
        Math.abs(state.x - previous.x) + Math.abs(state.y - previous.y) >
          0.0001;
      const actor = network?.actor;
      const combatVisual = (a: RealtimeActor) => ({
        health: a.combat?.health,
        hurt:
          !!a.combat &&
          a.combat.damageTick > 0 &&
          network!.visualTick - a.combat.damageTick < 10,
        dodging: !!a.combat && network!.visualTick < a.combat.dodgeUntil,
        attackAge: a.combat?.attack
          ? Math.max(0, network!.visualTick - a.combat.attack.startedTick)
          : undefined,
      });
      view.combat(network?.slime, network?.visualTick ?? 0);
      view.companions(network?.moss ?? []);
      view.resources(
        depleted(),
        actor?.combat?.health === 0 ? undefined : nearest(),
      );
      view.draw(
        {
          ...(actor ? combatVisual(actor) : {}),
          id: session?.playerId ?? "solo",
          name: username,
          character,
          position: rendered,
          facing: actor?.facing ?? facingIndex,
          moving: actor?.moving ?? moving,
          chopping:
            walkTime < gatherUntil
              ? gatherKind === "tree"
              : actor?.action?.resource === "tree",
          gathering:
            walkTime < gatherUntil ||
            (actor?.action?.kind === "gather" &&
              network!.tick - actor.action.startedTick < 30),
          waving: actor
            ? actor.action?.kind === "wave" &&
              network!.tick +
                Math.max(0, actor.ack - network!.ack) -
                actor.action.startedTick <
                48
            : walkTime < soloWaveUntil,
        },
        (network?.remotes() ?? []).map((a) => ({
          ...combatVisual(a),
          id: a.id,
          name: a.name,
          character: characterId(a.character),
          position: a.position,
          facing: a.facing,
          moving: a.moving,
          waving:
            a.action?.kind === "wave" &&
            network!.tick - a.action.startedTick < 48,
          chopping: a.action?.resource === "tree",
          gathering:
            a.action?.kind === "gather" &&
            network!.tick - a.action.startedTick < 30,
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
    // A regenerated world can reuse an already-focused host; no focus event fires.
    if (document.activeElement === host) resume();
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
