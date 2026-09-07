import {
  snapshotSchema,
  VERSION,
  type Session,
  type Snapshot,
  type Actor,
} from "../packages/protocol";
import {
  CONTENT_VERSION,
  GENERATION_VERSION,
  generateWorld,
} from "../packages/world";
import {
  step,
  interpolate,
  type Position,
  type Input,
} from "../packages/simulation";
export const gateways = () => {
  const configured = process.env.NEXT_PUBLIC_GAME_GATEWAYS;
  if (configured) return configured.split(",");
  if (
    typeof location !== "undefined" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)
  )
    return [`${location.origin}/api/meadow`];
  return ["http://127.0.0.1:3101", "http://127.0.0.1:3102"];
};
export async function joinMeadow(
  name: string,
  invite?: string,
): Promise<Session> {
  const saved = sessionStorage.getItem("meadow-session");
  if (saved && !invite) {
    try {
      return JSON.parse(saved) as Session;
    } catch {
      sessionStorage.removeItem("meadow-session");
    }
  }
  let last = "The Meadow service is unavailable. Please try again shortly.";
  for (const gateway of gateways()) {
    try {
      const response = await fetch(`${gateway}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...(invite ? { invite } : {}) }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      if (!response.ok) {
        last = data.error ?? last;
        break;
      }
      sessionStorage.setItem("meadow-session", JSON.stringify(data));
      return data as Session;
    } catch {
      /* Try another configured gateway. */
    }
  }
  throw Error(last);
}
export class MeadowConnection {
  status = "Connecting…";
  position: Position = { x: 64.5, y: 64.5 };
  generation = 0;
  epoch = 0;
  tick = 0;
  owner = "";
  gateway = "";
  authoritative: Position = this.position;
  private socket: WebSocket | null = null;
  private disposed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private seq = 0;
  private attempt = 0;
  private endpoint = 0;
  private lastSnapshot = 0;
  private pending: { seq: number; input: Input }[] = [];
  private snapshots: { at: number; data: Snapshot }[] = [];
  private world;
  constructor(readonly session: Session) {
    this.world = generateWorld(session.seed);
    this.connect();
  }
  private connect() {
    if (this.disposed) return;
    this.generation = 0;
    const endpoints = gateways(),
      url = endpoints[this.endpoint++ % endpoints.length].replace(
        /^http/,
        "ws",
      );
    const socket = new WebSocket(`${url}/play`);
    this.socket = socket;
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          type: "hello",
          protocolVersion: VERSION,
          worldId: this.session.worldId,
          token: this.session.token,
          contentVersion: CONTENT_VERSION,
          generationVersion: GENERATION_VERSION,
        }),
      );
    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (
        data.type === "connected" &&
        data.worldId === this.session.worldId &&
        Number.isSafeInteger(data.generation)
      ) {
        this.generation = data.generation;
        this.gateway = typeof data.gateway === "string" ? data.gateway : "";
        this.seq = 0;
        this.pending = [];
        this.snapshots = [];
        this.tick = 0;
        this.status = "Rejoining the Meadow…";
        return;
      }
      const parsed = snapshotSchema.safeParse(data);
      if (!parsed.success) {
        this.resync();
        return;
      }
      const s = parsed.data;
      if (
        s.worldId !== this.session.worldId ||
        s.seed !== this.session.seed ||
        s.epoch < this.epoch
      )
        return;
      if (s.epoch === this.epoch && s.tick <= this.tick) return;
      const self = s.actors.find((a) => a.id === this.session.playerId);
      if (!self || self.generation !== this.generation) {
        this.resync();
        return;
      }
      if (s.epoch !== this.epoch) {
        this.pending = [];
        this.snapshots = [];
      }
      this.epoch = s.epoch;
      this.tick = s.tick;
      this.owner = s.owner;
      this.authoritative = self.position;
      this.pending = this.pending.filter((p) => p.seq > self.ack);
      this.position = this.pending.reduce(
        (p, item) => step(this.world, p, item.input),
        self.position,
      );
      this.snapshots.push({ at: performance.now(), data: s });
      if (this.snapshots.length > 6) this.snapshots.shift();
      this.lastSnapshot = performance.now();
      this.status = "Connected";
      this.attempt = 0;
    };
    socket.onclose = (event) => {
      this.pending = [];
      this.status =
        event.code === 4003
          ? "This session has expired. Leave and start a new Meadow."
          : event.code === 4001
            ? "This adventurer is open in another tab."
            : "Reconnecting…";
      if (this.disposed || event.code === 4001 || event.code === 4003) return;
      this.timer = setTimeout(
        () => this.connect(),
        Math.min(10000, 500 * 2 ** Math.min(5, this.attempt++)) *
          (0.8 + Math.random() * 0.4),
      );
    };
    socket.onerror = () => socket.close();
    // Open connections with a lost owner/fanout must also recover, not hang forever.
    this.lastSnapshot = performance.now();
  }
  private resync() {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(
        JSON.stringify({
          type: "resync",
          protocolVersion: VERSION,
          worldId: this.session.worldId,
        }),
      );
  }
  advance(input: Input) {
    const age = performance.now() - this.lastSnapshot;
    if (age > 1000 && this.status === "Connected")
      this.status = "Reconnecting…";
    if (age > 3000 && this.socket?.readyState === WebSocket.OPEN)
      this.socket.close();
    if (this.generation && this.socket?.readyState === WebSocket.OPEN) {
      const movement = this.status === "Connected" ? input : { x: 0, y: 0 };
      const seq = ++this.seq;
      if (this.socket.bufferedAmount > 16384) {
        this.socket.close();
        return this.position;
      }
      this.socket.send(
        JSON.stringify({
          type: "input",
          protocolVersion: VERSION,
          worldId: this.session.worldId,
          generation: this.generation,
          seq,
          movement,
        }),
      );
      if (this.status === "Connected") {
        this.pending.push({ seq, input: movement });
        if (this.pending.length > 40) {
          this.pending = [];
          this.status = "Reconnecting…";
          return this.position;
        }
        this.position = step(this.world, this.position, movement);
      }
    }
    return this.position;
  }
  remotes(): Actor[] {
    const latest = this.snapshots.at(-1);
    if (!latest) return [];
    const target = performance.now() - 100;
    const after = this.snapshots.find((s) => s.at >= target) ?? latest;
    const before =
      this.snapshots.filter((s) => s.at <= target).at(-1) ?? this.snapshots[0];
    const alpha =
      after.at === before.at
        ? 1
        : Math.min(
            1,
            Math.max(0, (target - before.at) / (after.at - before.at)),
          );
    return latest.data.actors
      .filter((a) => a.id !== this.session.playerId)
      .map((a) => {
        const b = before.data.actors.find((p) => p.id === a.id),
          c = after.data.actors.find((p) => p.id === a.id);
        return {
          ...a,
          position:
            b && c
              ? interpolate(this.world, b.position, c.position, alpha)
              : a.position,
        };
      });
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.socket?.close();
  }
}
