import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { generateWorld, SPAWN } from "../packages/world";
import { collides } from "../packages/simulation";
import { InputTimeline, applyFrame } from "../packages/simulation/realtime";
import {
  parsePacket,
  packFrames,
  type RealtimeActor,
} from "../packages/protocol/realtime";
const world = generateWorld("meadow-001");
const actor = (): RealtimeActor => ({
  id: randomUUID(),
  name: "Rowan",
  character: "fern",
  position: { ...SPAWN },
  generation: 1,
  ack: 0,
  facing: 2,
  moving: false,
  action: null,
});
describe("60 Hz authoritative input timeline", () => {
  it("acks consumed contiguous frames, catches up jitter without packet-driven speed", () => {
    const q = new InputTimeline();
    let a = actor();
    q.enqueue([{ seq: 2, count: 59, keys: 8, facing: 0 }], 0);
    for (let tick = 1; tick <= 10; tick++) a = q.advance(world, a, tick);
    expect(a.ack).toBe(0);
    expect(a.position).toEqual(SPAWN);
    q.enqueue([{ seq: 1, count: 1, keys: 8, facing: 0 }], 0);
    a = q.advance(world, a, 11);
    expect(a.ack).toBe(6);
    for (let tick = 12; tick <= 30; tick++) a = q.advance(world, a, tick);
    expect(a.ack).toBe(30);
    expect(a.position.x - SPAWN.x).toBeCloseTo(2);
    expect(collides(world, a.position)).toBe(false);
  });
  it("replays predictions exactly and deduplicates waves, with server-owned cooldown", () => {
    const q = new InputTimeline();
    let server = actor(),
      predicted = server;
    for (let i = 1; i <= 30; i++) {
      const frame = {
        seq: i,
        keys: i < 15 ? 8 : 0,
        facing: 6,
        ...(i === 1 || i === 10 ? { wave: true as const } : {}),
      };
      predicted = applyFrame(world, predicted, frame, i);
      q.enqueue(packFrames([frame]), server.ack);
      q.enqueue(packFrames([frame]), server.ack);
      server = q.advance(world, server, i);
    }
    expect(server).toEqual(predicted);
    expect(server.action?.seq).toBe(1);
    expect(server.facing).toBe(6);
    expect(server.moving).toBe(false);
    const before = server.position;
    server = applyFrame(
      world,
      server,
      { seq: 31, keys: 0, facing: 4, wave: true },
      61,
    );
    expect(server.position).toEqual(before);
    expect(server.action?.seq).toBe(31);
  });
  it("rejects authority fields, oversized replay windows, contradictory retries and malformed facing", () => {
    const packet = {
      type: "frames",
      protocolVersion: 3,
      worldId: randomUUID(),
      generation: 1,
      runs: [{ seq: 1, count: 1, keys: 0, facing: 0 }],
    };
    expect(parsePacket(JSON.stringify(packet))).not.toBeNull();
    for (const invalid of [
      { ...packet, position: { x: 100, y: 100 } },
      { ...packet, runs: [{ seq: 1, count: 61, keys: 0, facing: 0 }] },
      { ...packet, runs: [{ seq: 1, count: 1, keys: 0, facing: 8 }] },
      { ...packet, runs: [...packet.runs, ...packet.runs] },
    ])
      expect(parsePacket(JSON.stringify(invalid))).toBeNull();
    const q = new InputTimeline();
    q.enqueue(packet.runs, 0);
    expect(() =>
      q.enqueue([{ seq: 1, count: 1, keys: 1, facing: 0 }], 0),
    ).toThrow("Conflicting");
    expect(() =>
      q.enqueue([{ seq: 61, count: 1, keys: 0, facing: 0 }], 0),
    ).toThrow("window");
  });
  it("normalizes diagonals and preserves collision across fine-grained steps", () => {
    let straight = actor(),
      diagonal = actor();
    for (let i = 1; i <= 15; i++) {
      straight = applyFrame(world, straight, { seq: i, keys: 8, facing: 0 }, i);
      diagonal = applyFrame(
        world,
        diagonal,
        { seq: i, keys: 10, facing: 1 },
        i,
      );
    }
    expect(
      Math.hypot(diagonal.position.x - SPAWN.x, diagonal.position.y - SPAWN.y),
    ).toBeCloseTo(straight.position.x - SPAWN.x);
    for (let i = 16; i < 3000; i++)
      diagonal = applyFrame(
        world,
        diagonal,
        { seq: i, keys: 10, facing: 1 },
        i,
      );
    expect(collides(world, diagonal.position)).toBe(false);
  });
});
