import { it, expect, vi, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { MeadowConnection } from "../app/network";
import { SPAWN } from "../packages/world";
class Socket {
  static OPEN = 1;
  static all: Socket[] = [];
  readyState = 1;
  bufferedAmount = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    Socket.all.push(this);
  }
  send(s: string) {
    this.sent.push(s);
  }
  close(code = 1000) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  receive(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Socket.all = [];
});
it("predicts every frame, batches separately, replays only unacked frames and renews without terminal replacement", () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const session = {
    worldId: randomUUID(),
    playerId: randomUUID(),
    token: "x".repeat(43),
    invite: "y".repeat(43),
    name: "Rowan",
    seed: "meadow-001",
    character: "fern" as const,
  };
  const c = new MeadowConnection(session),
    socket = Socket.all[0];
  socket.onopen?.();
  const connected = (s: Socket, generation: number) =>
    s.receive({
      type: "connected",
      protocolVersion: 6,
      worldId: session.worldId,
      generation,
      gateway: "a",
    });
  const snap = (
    s: Socket,
    generation: number,
    tick: number,
    ack: number,
    x: number = SPAWN.x,
  ) =>
    s.receive({
      type: "snapshot",
      protocolVersion: 6,
      worldId: session.worldId,
      selfId: session.playerId,
      seed: session.seed,
      epoch: 1,
      tick,
      owner: "a",
      actors: [
        {
          id: session.playerId,
          name: session.name,
          character: "fern",
          position: { x, y: SPAWN.y },
          generation,
          ack,
          facing: 0,
          moving: ack > 0,
          action: null,
        },
      ],
    });
  try {
    connected(socket, 1);
    snap(socket, 1, 1, 0);
    c.advance({ x: 1, y: 0 }, 0);
    c.advance({ x: 1, y: 0 }, 0);
    expect(c.position.x - SPAWN.x).toBeCloseTo(8 / 60);
    expect(socket.sent).toHaveLength(1);
    vi.advanceTimersByTime(50);
    expect(JSON.parse(socket.sent[1]).runs).toEqual([
      { seq: 1, keys: 8, facing: 0, count: 2 },
    ]);
    snap(socket, 1, 2, 1, SPAWN.x + 4 / 60);
    expect(c.position.x - SPAWN.x).toBeCloseTo(8 / 60);
    socket.receive({ type: "renew" });
    const replacement = Socket.all[1];
    replacement.onopen?.();
    socket.close(4001);
    connected(replacement, 2);
    snap(replacement, 2, 3, 0, SPAWN.x + 4 / 60);
    expect(c.status).toBe("Connected");
    expect(c.generation).toBe(2);
    c.wave();
    c.advance({ x: 0, y: 0 }, 4);
    expect(c.actor.action?.kind).toBe("wave");
    expect(c.actor.facing).toBe(4);
  } finally {
    c.dispose();
  }
});
