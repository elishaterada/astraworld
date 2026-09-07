import { COMBAT as C } from "../content/combat";
import { direction, combatBusy } from "./combat";
import { moveFor } from "./index";
import type { World } from "../world";
import {
  DT,
  type Frame,
  type RealtimeActor,
  type Run,
} from "../protocol/realtime";
export function movement(keys: number) {
  return {
    x: Number(!!(keys & 8)) - Number(!!(keys & 4)),
    y: Number(!!(keys & 2)) - Number(!!(keys & 1)),
  };
}
export function applyFrame(
  world: World,
  actor: RealtimeActor,
  frame: Frame,
  tick: number,
  allowAttack = true,
): RealtimeActor {
  let combat = actor.combat ? { ...actor.combat } : undefined;
  if (combat?.health === 0)
    return { ...actor, ack: frame.seq, moving: false, action: null };
  let action = actor.action;
  if (combat && !combatBusy(combat, tick)) {
    if (frame.dodge && tick >= combat.dodgeReady) {
      const input = movement(frame.keys);
      const facing =
        input.x || input.y
          ? (Math.round(Math.atan2(input.y, input.x) / (Math.PI / 4)) + 8) % 8
          : frame.facing;
      combat = {
        ...combat,
        attack: null,
        dodgeFacing: facing,
        dodgeSteps: C.dodgeTicks,
        dodgeUntil: tick + C.dodgeTicks,
        dodgeReady: tick + C.dodgeCooldown,
        invulnerableUntil: Math.max(
          combat.invulnerableUntil,
          tick + C.invulnerableTicks,
        ),
      };
      action = {
        kind: "dodge",
        seq: frame.seq,
        generation: actor.generation,
        startedTick: tick,
      };
    } else if (frame.attack && allowAttack) {
      combat = {
        ...combat,
        attack: { startedTick: tick, facing: frame.facing, hits: [] },
        attackReady: tick + C.windup + C.active + C.recovery,
      };
      action = {
        kind: "attack",
        seq: frame.seq,
        generation: actor.generation,
        startedTick: tick,
      };
    }
  }
  const dodging = combat && tick < combat.dodgeUntil && combat.dodgeSteps > 0;
  const position = moveFor(
    world,
    actor.position,
    dodging ? direction(combat!.dodgeFacing) : movement(frame.keys),
    DT *
      (dodging
        ? C.dodgeSpeed / 4
        : frame.keys & 16 && !combatBusy(combat, tick)
          ? 1.75
          : 1),
  );
  if (dodging) combat = { ...combat!, dodgeSteps: combat!.dodgeSteps - 1 };
  const acceptedWave =
    frame.wave &&
    !combatBusy(combat, tick) &&
    (!actor.action || tick - actor.action.startedTick >= 60);
  return {
    ...actor,
    position,
    ack: frame.seq,
    facing:
      combat && tick < combat.attackReady && combat.attack
        ? combat.attack.facing
        : dodging
          ? combat!.dodgeFacing
          : frame.facing,
    ...(combat ? { combat } : {}),
    moving:
      Math.hypot(position.x - actor.position.x, position.y - actor.position.y) >
      1e-8,
    action: acceptedWave
      ? {
          kind: "wave",
          seq: frame.seq,
          generation: actor.generation,
          startedTick: tick,
        }
      : action,
  };
}
/** Server-time credits cap simulation work, independent of packet count or client clocks. */
export class InputTimeline {
  readonly queued = new Map<number, Frame>();
  credits = 0;
  private lastProcessedTick = -100;
  enqueue(runs: Run[], ack: number) {
    for (const run of runs)
      for (let i = 0; i < run.count; i++) {
        const seq = run.seq + i;
        if (seq <= ack) continue;
        if (seq > ack + 60) throw Error("Prediction window exceeded");
        const frame: Frame = {
          seq,
          keys: run.keys,
          facing: run.facing,
          ...(i === 0 && run.wave ? { wave: true as const } : {}),
          ...(i === 0 && run.attack ? { attack: true as const } : {}),
          ...(i === 0 && run.dodge ? { dodge: true as const } : {}),
        };
        const existing = this.queued.get(seq);
        if (
          existing &&
          (existing.keys !== frame.keys ||
            existing.facing !== frame.facing ||
            existing.wave !== frame.wave ||
            existing.attack !== frame.attack ||
            existing.dodge !== frame.dodge)
        )
          throw Error("Conflicting replay");
        this.queued.set(seq, frame);
      }
  }
  advance(
    world: World,
    actor: RealtimeActor,
    tick: number,
    allowAttack = true,
  ) {
    this.credits = Math.min(30, this.credits + 1);
    let processed = 0;
    while (this.credits > 0 && processed < 6) {
      const frame = this.queued.get(actor.ack + 1);
      if (!frame) break;
      this.queued.delete(frame.seq);
      actor = applyFrame(world, actor, frame, tick, allowAttack);
      this.credits--;
      processed++;
    }
    if (processed) this.lastProcessedTick = tick;
    return processed || tick - this.lastProcessedTick < 6
      ? actor
      : { ...actor, moving: false };
  }
}
