import { freshGate } from "./utility";
import type { Gate } from "../protocol/utility";
import { TAMING as T } from "../content/taming";
import type {
  CompanionCommand,
  CompanionReceipt,
  Moss,
} from "../protocol/taming";
import type { RealtimeActor } from "../protocol/realtime";
import {
  CONTENT_VERSION,
  GENERATION_VERSION,
  SIZE,
  type World,
  isSolid,
} from "../world";
import { collides, moveFor, type Position } from "./index";
import { clearAttackLine, combatBusy, distance } from "./combat";
import type { GatheringState } from "./gathering";
export type MossInstance = Moss & {
  path: Position[];
  repathAt: number;
  stuck: number;
  recallAt: number;
  controlReady: number;
};
export type TamingState = {
  travelReady?: Record<string, number>;
  gate: Gate;
  creatures: MossInstance[];
  receipts: Record<string, CompanionReceipt>;
};
export const publicMoss = ({
  path,
  repathAt,
  stuck,
  recallAt,
  controlReady,
  ...m
}: MossInstance): Moss => m;
export function freshTaming(seed: string): TamingState {
  return {
    gate: freshGate(seed),
    creatures: [
      { x: 61.5, y: 64.5 },
      { x: 64.5, y: 68.5 },
    ].map((home, i) => ({
      id: `${GENERATION_VERSION}:${CONTENT_VERSION}:${seed}:moss:${i}`,
      kind: "moss-slime",
      position: { ...home },
      home,
      owner: null,
      claim: null,
      feeds: 0,
      mode: "curious",
      facing: 2,
      moving: false,
      fedTick: 0,
      path: [],
      repathAt: 0,
      stuck: 0,
      recallAt: 0,
      controlReady: 0,
    })),
    receipts: {},
  };
}
export function expireClaims(state: TamingState, tick: number): TamingState {
  return {
    ...state,
    creatures: state.creatures.map((m) =>
      m.claim && tick >= m.claim.expires ? { ...m, claim: null, feeds: 0 } : m,
    ),
  };
}
/** Cardinal BFS has a fixed work budget and returns center-to-center routes with body clearance. */
export function route(
  world: World,
  from: Position,
  to: Position,
  budget = 512,
): Position[] | null {
  const start = Math.floor(from.y) * SIZE + Math.floor(from.x),
    goal = Math.floor(to.y) * SIZE + Math.floor(to.x);
  if (collides(world, from) || collides(world, to)) return null;
  const queue = [start],
    parents = new Map<number, number>([[start, -1]]);
  for (let cursor = 0; cursor < queue.length && cursor < budget; cursor++) {
    const n = queue[cursor];
    if (n === goal) {
      const path: Position[] = [];
      for (let p = n; p !== start; p = parents.get(p)!)
        path.push({ x: (p % SIZE) + 0.5, y: Math.floor(p / SIZE) + 0.5 });
      return path.reverse();
    }
    const x = n % SIZE,
      y = Math.floor(n / SIZE);
    for (const [dx, dy] of [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        k = ny * SIZE + nx;
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= SIZE ||
        ny >= SIZE ||
        parents.has(k) ||
        isSolid(world, nx, ny)
      )
        continue;
      parents.set(k, n);
      queue.push(k);
    }
  }
  return null;
}
function safeRecall(
  world: World,
  m: MossInstance,
  actor: RealtimeActor,
  actors: RealtimeActor[],
  creatures: MossInstance[],
) {
  // Verify the existing creature and owner are connected before any relocation; future closed gates are respected.
  if (route(world, m.position, actor.position, SIZE * SIZE) === null)
    return null;
  for (let radius = 1; radius <= 3; radius++)
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const p = {
          x: Math.floor(actor.position.x) + dx + 0.5,
          y: Math.floor(actor.position.y) + dy + 0.5,
        };
        if (
          collides(world, p) ||
          actors.some((a) => distance(a.position, p) < 0.7) ||
          creatures.some((c) => c.id !== m.id && distance(c.position, p) < 0.7)
        )
          continue;
        if (route(world, actor.position, p, 128) !== null) return p;
      }
  return null;
}
/** One serial immutable transition couples receipt, food consumption, claim and ownership. */
export function commandCompanion(
  world: World,
  state: TamingState,
  gathering: GatheringState,
  actor: RealtimeActor,
  cmd: CompanionCommand,
  tick: number,
) {
  const prior = state.receipts[actor.id];
  if (!gathering.players[actor.id] || cmd.seq !== (prior?.seq ?? 0) + 1)
    return { taming: state, gathering };
  const expired = expireClaims(state, tick),
    m = expired.creatures.find((c) => c.id === cmd.target),
    p = gathering.players[actor.id];
  let result: CompanionReceipt["result"] = "missing",
    next = m;
  let inventory = p.inventory;
  if (actor.combat?.health === 0) result = "dead";
  else if (combatBusy(actor.combat, tick)) result = "busy";
  else if (!m) result = "missing";
  else if (cmd.action !== "feed") {
    if (m.owner !== actor.id) result = "forbidden";
    else if (tick < m.controlReady) result = "cooldown";
    else {
      result = cmd.action === "stay" ? "staying" : "following";
      next = {
        ...m,
        mode: cmd.action === "stay" ? "stay" : "follow",
        path: [],
        repathAt: 0,
        stuck: 0,
        recallAt: m.recallAt,
        controlReady: tick + T.controlCooldown,
      };
    }
  } else if (m.owner) result = "owned";
  else if (expired.creatures.some((c) => c.owner === actor.id))
    result = "already-companion";
  else if (m.claim && m.claim.player !== actor.id) result = "claimed";
  else if (distance(actor.position, m.position) > T.range) result = "range";
  else if (!clearAttackLine(world, actor.position, m.position))
    result = "blocked";
  else if (tick < p.readyTick || (m.claim && tick - m.fedTick < T.feedCooldown))
    result = "cooldown";
  else {
    const slot = inventory.findIndex((s) => s?.item === T.food);
    if (slot < 0) result = "food";
    else {
      inventory = inventory.map((s, i) =>
        i !== slot
          ? s
          : s!.quantity === 1
            ? null
            : { ...s!, quantity: s!.quantity - 1 },
      );
      const feeds = m.feeds + 1,
        tamed = feeds === T.feeds;
      next = {
        ...m,
        feeds,
        fedTick: tick,
        claim: tamed
          ? null
          : { player: actor.id, expires: tick + T.claimTicks },
        owner: tamed ? actor.id : null,
        mode: tamed ? "follow" : "curious",
      };
      result = tamed ? "tamed" : "fed";
    }
  }
  return {
    taming: {
      ...expired,
      creatures: expired.creatures.map((c) => (c.id === next?.id ? next! : c)),
      receipts: { ...expired.receipts, [actor.id]: { ...cmd, tick, result } },
    },
    gathering:
      inventory === p.inventory
        ? gathering
        : {
            ...gathering,
            players: {
              ...gathering.players,
              [actor.id]: { ...p, inventory, readyTick: tick + T.feedCooldown },
            },
          },
  };
}
export function stepTaming(
  world: World,
  state: TamingState,
  actors: RealtimeActor[],
  present: ReadonlySet<string>,
  tick: number,
): TamingState {
  const expired = expireClaims(state, tick);
  return {
    ...expired,
    creatures: expired.creatures.map((original) => {
      let m = { ...original, moving: false };
      const owner = actors.find((a) => a.id === m.owner);
      if (
        !owner ||
        !present.has(owner.id) ||
        owner.combat?.health === 0 ||
        m.mode === "stay"
      )
        return { ...m, path: [] };
      const d = distance(m.position, owner.position);
      if (
        (d > T.recallDistance ||
          m.stuck >= T.stuckTicks ||
          m.mode === "recovering") &&
        tick >= m.recallAt
      ) {
        const p = safeRecall(world, m, owner, actors, expired.creatures);
        return {
          ...m,
          position: p ?? m.position,
          mode: p ? "follow" : "recovering",
          path: [],
          stuck: 0,
          recallAt: tick + 60,
        };
      }
      if (d <= T.followDistance)
        return { ...m, path: [], stuck: 0, mode: "follow" };
      if (tick >= m.repathAt) {
        const direct = clearAttackLine(world, m.position, owner.position);
        const path = direct
          ? [owner.position]
          : route(world, m.position, owner.position);
        m = { ...m, path: path ?? [], repathAt: tick + T.repathTicks };
      }
      let target = m.path[0];
      if (target && distance(m.position, target) < 0.12) {
        m.path = m.path.slice(1);
        target = m.path[0];
      }
      if (!target) return { ...m, stuck: m.stuck + 1 };
      const delta = { x: target.x - m.position.x, y: target.y - m.position.y };
      const position = moveFor(world, m.position, delta, T.speed / 4 / 60);
      const moved = distance(m.position, position) > 0.0001;
      return {
        ...m,
        position,
        moving: moved,
        stuck: moved ? 0 : m.stuck + 1,
        facing:
          (Math.round(Math.atan2(delta.y, delta.x) / (Math.PI / 4)) + 8) % 8,
      };
    }),
  };
}
