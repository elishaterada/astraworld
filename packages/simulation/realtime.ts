import { weaponAttack, WEAPONS, CHARGE_TICKS, BLOCK } from "../content/weapons";
import { COMBAT as C, COMBO_WINDOW } from "../content/combat";
import { direction, attackBusy as combatBusy } from "./combat";
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
  if (combat && frame.cancel) {
    combat.charging = undefined;
    combat.blocking = undefined;
  }
  if (combat) {
    if (frame.block) combat.charging = undefined;
    if (
      frame.weapon &&
      !combatBusy(combat, tick) &&
      combat.charging === undefined &&
      combat.blocking === undefined
    )
      combat = { ...combat, weapon: frame.weapon, combo: undefined };
    if (!frame.block) combat.blocking = undefined;
    if (
      frame.block &&
      combat.blocking === undefined &&
      tick >= (combat.blockReady ?? 0) &&
      !combatBusy(combat, tick) &&
      combat.charging === undefined
    ) {
      combat.blocking = tick;
      combat.blockReady = tick + BLOCK.rearmTicks;
    }
    if (
      frame.charge &&
      combat.charging === undefined &&
      combat.blocking === undefined &&
      !combatBusy(combat, tick)
    )
      combat.charging = tick;
  }
  const releasedCharge = combat?.charging !== undefined && !frame.charge;

  const recoveryRoll =
    combat?.attack &&
    tick >=
      combat.attack.startedTick +
        weaponAttack(
          combat.attack.weapon,
          combat.attack.combo,
          combat.attack.charge,
          combat.attack.skill,
        ).windup +
        weaponAttack(
          combat.attack.weapon,
          combat.attack.combo,
          combat.attack.charge,
          combat.attack.skill,
        ).active;
  if (combat && (!combatBusy(combat, tick) || (frame.dodge && recoveryRoll))) {
    if (frame.dodge && tick >= combat.dodgeReady) {
      const input = movement(frame.keys);
      const facing =
        input.x || input.y
          ? (Math.round(Math.atan2(input.y, input.x) / (Math.PI / 4)) + 8) % 8
          : frame.facing;
      combat = {
        ...combat,
        attack: null,
        charging: undefined,
        blocking: undefined,
        attackReady: tick,
        combo: undefined,
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
    } else if (
      (frame.attack || releasedCharge || frame.skill) &&
      allowAttack &&
      !combatBusy(combat, tick) &&
      combat.blocking === undefined &&
      (!frame.charge || releasedCharge) &&
      (!frame.skill || tick >= (combat.skillReady ?? 0))
    ) {
      const combo =
        combat.combo && tick <= combat.combo.until
          ? (combat.combo.step + 1) % 3
          : 0;
      const weapon = combat.weapon ?? "blade",
        charge =
          releasedCharge && !frame.skill
            ? Math.min(1, (tick - combat.charging!) / CHARGE_TICKS)
            : 0,
        skill = !!frame.skill;
      const profile = weaponAttack(weapon, combo, charge, skill);
      combat = {
        ...combat,
        attack: {
          startedTick: tick,
          facing: frame.facing,
          hits: [],
          combo,
          weapon,
          charge,
          skill,
          origin: { ...actor.position },
        },
        charging: undefined,
        skillReady: skill ? tick + WEAPONS[weapon].cooldown : combat.skillReady,
        combo: {
          step: combo,
          until:
            tick +
            profile.windup +
            profile.active +
            profile.recovery +
            COMBO_WINDOW,
        },
        attackReady: tick + profile.windup + profile.active + profile.recovery,
      };
      action = {
        kind: "attack",
        seq: frame.seq,
        generation: actor.generation,
        startedTick: tick,
      };
    }
  }
  if (releasedCharge && combat?.charging !== undefined)
    combat.charging = undefined;
  const dodging = combat && tick < combat.dodgeUntil && combat.dodgeSteps > 0;
  const position = moveFor(
    world,
    actor.position,
    dodging ? direction(combat!.dodgeFacing) : movement(frame.keys),
    DT *
      (dodging
        ? C.dodgeSpeed / 4
        : combat &&
            (combat.blocking !== undefined || combat.charging !== undefined)
          ? 0.45
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
          ...(run.charge !== undefined ? { charge: run.charge } : {}),
          ...(run.block !== undefined ? { block: run.block } : {}),
          ...(i === 0 && run.skill ? { skill: true as const } : {}),
          ...(i === 0 && run.cancel ? { cancel: true as const } : {}),
          ...(i === 0 && run.weapon ? { weapon: run.weapon } : {}),
        };
        const existing = this.queued.get(seq);
        if (
          existing &&
          (existing.keys !== frame.keys ||
            existing.facing !== frame.facing ||
            existing.wave !== frame.wave ||
            existing.attack !== frame.attack ||
            existing.dodge !== frame.dodge ||
            existing.charge !== frame.charge ||
            existing.block !== frame.block ||
            existing.skill !== frame.skill ||
            existing.cancel !== frame.cancel ||
            existing.weapon !== frame.weapon)
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
      : {
          ...actor,
          moving: false,
          ...(actor.combat
            ? {
                combat: {
                  ...actor.combat,
                  charging: undefined,
                  blocking: undefined,
                },
              }
            : {}),
        };
  }
}
