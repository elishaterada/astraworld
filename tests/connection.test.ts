import { afterEach, expect, it, vi } from "vitest";
import { MeadowConnection } from "../app/network";
const session = {
  worldId: "00000000-0000-4000-8000-000000000001",
  playerId: "00000000-0000-4000-8000-000000000002",
  token: "x".repeat(43),
  invite: "y".repeat(43),
  seed: "meadow-001",
  name: "Rowan",
};
class Socket {
  static OPEN = 1;
  static last: Socket;
  readyState = 1;
  bufferedAmount = 0;
  closed = false;
  onopen?: () => void;
  onmessage?: (e: { data: string }) => void;
  onclose?: () => void;
  onerror?: () => void;
  constructor() {
    Socket.last = this;
  }
  send() {}
  close() {
    this.closed = true;
    this.readyState = 3;
  }
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("waits through an owner lease on an authenticated socket without predicting offline movement", () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("WebSocket", Socket);
  const client = new MeadowConnection(session);
  const socket = Socket.last;
  socket.onopen?.();
  socket.onmessage?.({
    data: JSON.stringify({
      type: "connected",
      worldId: session.worldId,
      generation: 1,
    }),
  });
  now = 12000;
  expect(client.advance({ x: 1, y: 0 })).toEqual({ x: 64.5, y: 64.5 });
  expect(socket.closed).toBe(false);
  now = 15001;
  client.advance({ x: 0, y: 0 });
  expect(socket.closed).toBe(true);
  client.dispose();
});
it("keeps the shorter watchdog for an incomplete handshake", () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("WebSocket", Socket);
  const client = new MeadowConnection(session);
  now = 3001;
  client.advance({ x: 0, y: 0 });
  expect(Socket.last.closed).toBe(true);
  client.dispose();
});
