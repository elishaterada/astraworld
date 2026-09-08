import { rememberSession, parseRecovery } from "./recovery";
import type { Gate } from "../packages/protocol/utility";
import type {
  Moss,
  CompanionCommand,
  CompanionReceipt,
} from "../packages/protocol/taming";
import type { Slime } from "../packages/protocol/combat";
import { decodeDepletion } from "../packages/protocol/resources";
import { resourceNodes } from "../packages/world/resources";
import { type Progress, type GatherCommand } from "../packages/content";
import { SESSION_STORAGE_KEY } from "../packages/protocol/capacity";
import { type Session } from "../packages/protocol";
import {
  REALTIME_VERSION,
  DT,
  packFrames,
  realtimeSnapshotSchema,
  type Frame,
  type RealtimeActor,
  type RealtimeSnapshot,
} from "../packages/protocol/realtime";
import {
  CONTENT_VERSION,
  GENERATION_VERSION,
  generateWorld,
  SPAWN,
} from "../packages/world";
import {
  interpolate,
  collides,
  type Position,
  type Input,
} from "../packages/simulation";
import { applyFrame } from "../packages/simulation/realtime";
import { characterId, type CharacterId } from "../packages/characters";
export function savedSession(): Session | undefined {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(SESSION_STORAGE_KEY) ??
        localStorage.getItem(SESSION_STORAGE_KEY) ??
        "null",
    );
    if (value?.durable) return parseRecovery(JSON.stringify(value));
    if (
      value?.worldId &&
      value?.playerId &&
      value?.token &&
      typeof value.name === "string"
    )
      return { ...value, character: characterId(value.character) };
  } catch {
    /* Missing or invalid local session. */
  }
}
export const gateways = () => {
  const configured = process.env.NEXT_PUBLIC_GAME_GATEWAYS;
  if (configured) return configured.split(",");
  if (
    typeof location !== "undefined" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)
  )
    return [`${location.origin}/api/meadow-v2`];
  return ["http://127.0.0.1:3103", "http://127.0.0.1:3104"];
};
export async function joinMeadow(
  name: string,
  invite?: string,
  character: CharacterId = "fern",
): Promise<Session> {
  const saved = savedSession();
  if (saved && !invite) return saved;
  let last = "The Meadow service is unavailable. Please try again shortly.";
  for (const gateway of gateways()) {
    try {
      const response = await fetch(`${gateway}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          character,
          ...(invite ? { invite } : {}),
        }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      if (!response.ok) {
        last = data.error ?? last;
        break;
      }
      rememberSession(data as Session);
      return data as Session;
    } catch {
      /* Try another configured gateway. */
    }
  }
  throw Error(last);
}

export class MeadowConnection {
  benches: NonNullable<RealtimeSnapshot["benches"]> = [];
  roster: NonNullable<RealtimeSnapshot["roster"]> = [];
  gate?: Gate;
  moss: Moss[] = [];
  companionReceipt?: CompanionReceipt;
  private companionPending?: CompanionCommand;
  progress?: Progress;
  slime?: Slime;
  private attackQueued = false;
  private dodgeQueued = false;
  depleted: string[] = [];
  private gatherPending?: GatherCommand;
  status = "Connecting…";
  position: Position = { ...SPAWN };
  authoritative: Position = this.position;
  generation = 0;
  epoch = 0;
  tick = 0;
  owner = "";
  gateway = "";
  sent = 0;
  sentBytes = 0;
  correction = 0;
  actor: RealtimeActor;
  private socket: WebSocket | null = null;
  private candidate: WebSocket | null = null;
  private disposed = false;
  private terminal = false;
  private attempt = 0;
  private endpoint = 0;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private timer: ReturnType<typeof setInterval>;
  private seq = 0;
  private lastSend = 0;
  private pending: Frame[] = [];
  private snapshots: { at: number; data: RealtimeSnapshot }[] = [];
  private lastSnapshot = 0;
  private openedAt = 0;
  private renewAt = 0;
  private baseline = false;
  private offset = { x: 0, y: 0 };
  private world;
  private nodes;
  private waveQueued = false;
  constructor(readonly session: Session) {
    this.world = generateWorld(session.seed);
    this.nodes = resourceNodes(this.world);
    this.actor = {
      id: session.playerId,
      name: session.name,
      character: characterId(session.character),
      position: this.position,
      generation: 0,
      ack: 0,
      facing: 2,
      moving: false,
      action: null,
    };
    this.connect();
    this.timer = setInterval(() => this.flush(), 25);
  }
  get ack() {
    return this.actor.ack - this.pending.length;
  }
  get snapshotAge() {
    return performance.now() - this.lastSnapshot;
  }
  get gathering() {
    return !!this.gatherPending;
  }
  companion(action: CompanionCommand["action"], target: string) {
    if (!this.baseline || this.snapshotAge > 750 || this.companionPending)
      return false;
    this.companionPending = {
      seq: (this.companionReceipt?.seq ?? 0) + 1,
      action,
      target,
    };
    return true;
  }
  gather(target: string, action?: "craft" | "place") {
    if (
      !this.baseline ||
      this.snapshotAge > 750 ||
      !this.progress ||
      this.gatherPending
    )
      return false;
    this.gatherPending = {
      seq: (this.progress.receipt?.seq ?? 0) + 1,
      target,
      ...(action ? { action } : {}),
    };
    return true;
  }
  attack() {
    this.attackQueued = true;
  }
  dodge() {
    this.dodgeQueued = true;
  }
  get visualTick() {
    return this.tick + Math.min(150, this.snapshotAge) / 1000 / DT;
  }
  wave() {
    this.waveQueued = true;
  }
  private connect() {
    if (this.disposed || this.terminal || this.candidate) return;
    const endpoints = gateways(),
      url = endpoints[this.endpoint++ % endpoints.length].replace(
        /^http/,
        "ws",
      );
    const socket = new WebSocket(`${url}/play`);
    this.candidate = socket;
    this.openedAt = performance.now();
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          type: "hello",
          protocolVersion: REALTIME_VERSION,
          worldId: this.session.worldId,
          token: this.session.token,
          qol: true,
          contentVersion: CONTENT_VERSION,
          generationVersion: GENERATION_VERSION,
        }),
      );
    socket.onmessage = (event) => {
      if (this.disposed) return;
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (
        data.type === "connected" &&
        socket === this.candidate &&
        data.protocolVersion === REALTIME_VERSION &&
        data.worldId === this.session.worldId &&
        Number.isSafeInteger(data.generation) &&
        data.generation > 0
      ) {
        const old = this.socket;
        this.socket = socket;
        this.candidate = null;
        old?.close();
        this.generation = data.generation;
        this.gateway = String(data.gateway);
        this.seq = 0;
        this.pending = [];
        this.baseline = false;
        this.actor = {
          ...this.actor,
          generation: this.generation,
          ack: 0,
          action: null,
        };
        this.lastSnapshot = performance.now();
        this.renewAt = performance.now() + 240000;
        this.status = "Rejoining the Meadow…";
        return;
      }
      if (socket !== this.socket) return;
      if (data.type === "renew") {
        this.connect();
        return;
      }
      const parsed = realtimeSnapshotSchema.safeParse(data);
      if (!parsed.success) return;
      const s = parsed.data;
      if (
        s.worldId !== this.session.worldId ||
        s.seed !== this.session.seed ||
        s.epoch < this.epoch ||
        (this.baseline && s.epoch === this.epoch && s.tick <= this.tick)
      )
        return;
      const self = s.actors.find((a) => a.id === this.session.playerId);
      if (!self || self.generation !== this.generation || self.ack > this.seq)
        return;
      if (s.epoch !== this.epoch) this.snapshots = [];
      const before = this.display(0);
      this.epoch = s.epoch;
      this.tick = s.tick;
      this.owner = s.owner;
      this.roster = s.roster ?? s.actors;
      this.benches = s.benches ?? [];
      this.progress = s.progress;
      this.slime = s.slime;
      this.gate = s.gate;
      this.world = {
        ...this.world,
        gateOpen: s.gate?.open ?? false,
        benches: this.benches,
      };
      this.moss = s.moss ?? [];
      this.companionReceipt = s.companionReceipt;
      if (
        this.companionPending &&
        (s.companionReceipt?.seq ?? 0) >= this.companionPending.seq
      )
        this.companionPending = undefined;
      if (s.depleted)
        this.depleted =
          decodeDepletion(this.nodes, s.depleted) ?? this.depleted;
      if (
        this.gatherPending &&
        (s.progress?.receipt?.seq ?? 0) >= this.gatherPending.seq
      )
        this.gatherPending = undefined;
      this.authoritative = self.position;
      this.pending = this.pending.filter((f) => f.seq > self.ack);
      this.actor = this.pending.reduce(
        (a, f, i) => applyFrame(this.world, a, f, s.tick + i + 1),
        self,
      );
      this.position = this.actor.position;
      this.correction = Math.hypot(
        before.x - this.position.x,
        before.y - this.position.y,
      );
      this.offset =
        this.baseline && this.correction < 1.5
          ? { x: before.x - this.position.x, y: before.y - this.position.y }
          : { x: 0, y: 0 };
      this.snapshots.push({ at: performance.now(), data: s });
      if (this.snapshots.length > 12) this.snapshots.shift();
      this.lastSnapshot = performance.now();
      this.baseline = true;
      this.status = "Connected";
      this.attempt = 0;
    };
    socket.onclose = (event) => {
      if (socket !== this.socket && socket !== this.candidate) return;
      if (socket === this.candidate) {
        this.candidate = null;
        this.renewAt = performance.now() + 2000;
      }
      if (socket === this.socket) this.socket = null;
      if (this.disposed) return;
      if (event.code === 4001 && this.candidate) return; // Our replacement already authenticated.
      if (event.code === 4003 || event.code === 4001) {
        this.terminal = true;
        this.status =
          event.code === 4003
            ? "This session has expired. Leave and start a new Meadow."
            : "This adventurer is open in another tab.";
        return;
      }
      if (this.socket || this.candidate) return;
      this.status = "Reconnecting…";
      this.baseline = false;
      this.retry = setTimeout(
        () => this.connect(),
        Math.min(2000, 200 * 2 ** Math.min(4, this.attempt++)),
      );
    };
    socket.onerror = () => socket.close();
  }
  private flush() {
    if (this.disposed || this.terminal) return;
    const now = performance.now();
    if (this.candidate && now - this.openedAt > 5000) this.candidate.close();
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (now >= this.renewAt && !this.candidate) this.connect();
    if (this.snapshotAge > 750) this.status = "Reconnecting…";
    if (this.snapshotAge > 5000) {
      socket.close();
      return;
    }
    if (socket.bufferedAmount > 16384) {
      socket.close();
      return;
    }
    if (
      !this.companionPending &&
      !this.gatherPending &&
      !this.pending.length &&
      now - this.lastSend < 1000
    )
      return;
    this.lastSend = now;
    const raw = JSON.stringify({
      type: "frames",
      protocolVersion: REALTIME_VERSION,
      worldId: this.session.worldId,
      generation: this.generation,
      runs: packFrames(this.pending),
      ...(this.gatherPending ? { gather: this.gatherPending } : {}),
      ...(this.companionPending ? { companion: this.companionPending } : {}),
    });
    socket.send(raw);
    this.sent++;
    this.sentBytes += raw.length;
  }
  advance(input: Input, facing = this.actor.facing, running = false) {
    if (!this.baseline || this.snapshotAge > 750 || this.pending.length >= 60) {
      this.actor = { ...this.actor, moving: false };
      return this.position;
    }
    const keys =
      (input.y < 0 ? 1 : 0) |
      (input.y > 0 ? 2 : 0) |
      (input.x < 0 ? 4 : 0) |
      (input.x > 0 ? 8 : 0) |
      (running && (input.x || input.y) ? 16 : 0);
    if (
      !keys &&
      !this.actor.moving &&
      facing === this.actor.facing &&
      !this.waveQueued &&
      !this.attackQueued &&
      !this.dodgeQueued &&
      !(this.actor.combat && this.visualTick < this.actor.combat.dodgeUntil) &&
      !this.pending.length
    )
      return this.position;
    const frame: Frame = {
      seq: ++this.seq,
      keys,
      facing,
      ...(this.waveQueued ? { wave: true as const } : {}),
      ...(this.attackQueued ? { attack: true as const } : {}),
      ...(this.dodgeQueued ? { dodge: true as const } : {}),
    };
    this.waveQueued = false;
    this.attackQueued = false;
    this.dodgeQueued = false;
    this.pending.push(frame);
    this.actor = applyFrame(
      this.world,
      this.actor,
      frame,
      this.tick + this.pending.length,
    );
    this.position = this.actor.position;
    return this.position;
  }
  display(dt: number): Position {
    const decay = Math.exp(-dt / 0.08);
    this.offset.x *= decay;
    this.offset.y *= decay;
    const p = {
      x: this.position.x + this.offset.x,
      y: this.position.y + this.offset.y,
    };
    return collides(this.world, p) ? this.position : p;
  }
  remotes(): RealtimeActor[] {
    const latest = this.snapshots.at(-1);
    if (!latest) return [];
    // A server-tick timeline avoids stretching gait with each individual packet's arrival jitter.
    const target =
      latest.data.tick +
      Math.min(150, performance.now() - latest.at) / 1000 / DT -
      4;
    const after = this.snapshots.find((s) => s.data.tick >= target) ?? latest;
    const before =
      this.snapshots.filter((s) => s.data.tick <= target).at(-1) ??
      this.snapshots[0];
    const alpha =
      after.data.tick === before.data.tick
        ? 1
        : Math.max(
            0,
            Math.min(
              1,
              (target - before.data.tick) /
                (after.data.tick - before.data.tick),
            ),
          );
    return latest.data.actors
      .filter((a) => a.id !== this.session.playerId)
      .map((a) => {
        const b = before.data.actors.find((p) => p.id === a.id),
          c = after.data.actors.find((p) => p.id === a.id);
        return {
          ...(alpha < 1 ? (b ?? a) : (c ?? a)),
          moving: this.snapshotAge < 300 && (c ?? a).moving,
          position:
            b &&
            c &&
            Math.hypot(
              b.position.x - c.position.x,
              b.position.y - c.position.y,
            ) < 2
              ? interpolate(this.world, b.position, c.position, alpha)
              : a.position,
        };
      });
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    clearTimeout(this.retry);
    this.socket?.close();
    this.candidate?.close();
  }
}
