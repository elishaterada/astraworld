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
): RealtimeActor {
  const position = moveFor(world, actor.position, movement(frame.keys), DT);
  const acceptedWave =
    frame.wave && (!actor.action || tick - actor.action.startedTick >= 60);
  return {
    ...actor,
    position,
    ack: frame.seq,
    facing: frame.facing,
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
      : actor.action,
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
        };
        const existing = this.queued.get(seq);
        if (
          existing &&
          (existing.keys !== frame.keys ||
            existing.facing !== frame.facing ||
            existing.wave !== frame.wave)
        )
          throw Error("Conflicting replay");
        this.queued.set(seq, frame);
      }
  }
  advance(world: World, actor: RealtimeActor, tick: number) {
    this.credits = Math.min(30, this.credits + 1);
    let processed = 0;
    while (this.credits > 0 && processed < 6) {
      const frame = this.queued.get(actor.ack + 1);
      if (!frame) break;
      this.queued.delete(frame.seq);
      actor = applyFrame(world, actor, frame, tick);
      this.credits--;
      processed++;
    }
    if (processed) this.lastProcessedTick = tick;
    return processed || tick - this.lastProcessedTick < 6
      ? actor
      : { ...actor, moving: false };
  }
}
