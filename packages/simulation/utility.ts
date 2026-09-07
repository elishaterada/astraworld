import { DISSOLVE as D } from "../content/utility";
import { CONTENT_VERSION, GENERATION_VERSION, type World } from "../world";
import { VINE_TARGET } from "../world/forest";
import type { Gate } from "../protocol/utility";
import type { CompanionCommand } from "../protocol/taming";
import type { RealtimeActor } from "../protocol/realtime";
import type { TamingState } from "./taming";
import { clearAttackLine, combatBusy, distance } from "./combat";
export const freshGate = (seed: string): Gate => ({
  id: `${GENERATION_VERSION}:${CONTENT_VERSION}:${seed}:vine:0`,
  tag: D.tag,
  open: false,
  openedTick: null,
  channel: null,
});
function allowed(
  world: World,
  state: TamingState,
  actor: RealtimeActor,
  companion: string,
  tick: number,
) {
  const m = state.creatures.find(
    (c) => c.id === companion && c.owner === actor.id,
  );
  if (!m) return "forbidden" as const;
  if (actor.combat?.health === 0) return "dead" as const;
  if (combatBusy(actor.combat, tick) || m.mode !== "follow")
    return "busy" as const;
  if (
    distance(actor.position, VINE_TARGET) > D.actorRange ||
    distance(m.position, VINE_TARGET) > D.range
  )
    return "range" as const;
  if (
    !clearAttackLine(world, actor.position, VINE_TARGET) ||
    !clearAttackLine(world, m.position, VINE_TARGET)
  )
    return "blocked" as const;
  return null;
}
/** Uses the companion command sequence; no client may submit a completion or an open flag. */
export function commandDissolve(
  world: World,
  state: TamingState,
  actor: RealtimeActor,
  cmd: CompanionCommand,
  tick: number,
): TamingState {
  if (cmd.seq !== (state.receipts[actor.id]?.seq ?? 0) + 1) return state;
  const m = state.creatures.find((c) => c.owner === actor.id);
  const result =
    cmd.target !== state.gate.id
      ? "missing"
      : !m
        ? "forbidden"
        : state.gate.open
          ? "already-open"
          : state.gate.channel
            ? "busy"
            : (allowed(world, state, actor, m.id, tick) ??
              (tick < m.controlReady ? "cooldown" : "channeling"));
  return {
    ...state,
    gate:
      result === "channeling"
        ? {
            ...state.gate,
            channel: {
              player: actor.id,
              companion: m!.id,
              generation: actor.generation,
              seq: cmd.seq,
              startedTick: tick,
              endsTick: tick + D.channelTicks,
            },
          }
        : state.gate,
    creatures:
      result === "channeling"
        ? state.creatures.map((c) =>
            c.id === m!.id ? { ...c, controlReady: tick + D.cooldownTicks } : c,
          )
        : state.creatures,
    receipts: { ...state.receipts, [actor.id]: { ...cmd, tick, result } },
  };
}
export function stepUtility(
  world: World,
  state: TamingState,
  actors: RealtimeActor[],
  present: ReadonlySet<string>,
  tick: number,
): TamingState {
  const c = state.gate.channel;
  if (!c) return state;
  const a = actors.find((a) => a.id === c.player);
  const cancelled =
    !a ||
    !present.has(c.player) ||
    a.generation !== c.generation ||
    !!allowed(world, state, a, c.companion, tick);
  if (!cancelled && tick < c.endsTick) return state;
  const gate = {
    ...state.gate,
    channel: null,
    open: !cancelled,
    openedTick: cancelled ? null : tick,
  };
  const receipt = state.receipts[c.player];
  return {
    ...state,
    gate,
    receipts:
      receipt?.seq === c.seq
        ? {
            ...state.receipts,
            [c.player]: {
              ...receipt,
              tick,
              result: cancelled ? "cancelled" : "opened",
            },
          }
        : state.receipts,
  };
}
