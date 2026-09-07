import { createClient } from "redis";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Actor, Session } from "../../packages/protocol";
import { CONTENT_VERSION, GENERATION_VERSION } from "../../packages/world";
import { characterId, type CharacterId } from "../../packages/characters";
export type Metadata = {
  seed: string;
  invite: string;
  contentVersion: string;
  generationVersion: string;
};
export const compatible = (meta: Metadata | null) =>
  !!meta &&
  meta.contentVersion === CONTENT_VERSION &&
  meta.generationVersion === GENERATION_VERSION;
export const TTL = 1800;
export const LEASE_MS = 10000;
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export type Presence = {
  generation: number;
  seq: number;
  x: number;
  y: number;
  at: number;
};
export type Checkpoint = { tick: number; actors: Actor[] };
export class Store {
  readonly redis;
  constructor(
    url: string,
    readonly prefix: string,
    readonly leaseMs = LEASE_MS,
  ) {
    if (!/^(local|test|preview|production):[a-zA-Z0-9_-]+$/.test(prefix))
      throw Error("Use an explicit environment namespace");
    this.redis = createClient({
      url,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: (retries) => Math.min(200 + retries * 100, 2000),
      },
    });
    this.redis.on("error", () => {});
  }
  key(world: string, suffix: string) {
    return `${this.prefix}:{${world}}:${suffix}`;
  }
  async connect() {
    await this.redis.connect();
  }
  async close() {
    if (this.redis.isOpen) this.redis.destroy();
  }
  async create(
    name: string,
    character: CharacterId = "fern",
  ): Promise<Session> {
    const worldId = randomUUID(),
      playerId = randomUUID(),
      token = randomBytes(32).toString("base64url"),
      invite = randomBytes(32).toString("base64url");
    const meta: Metadata = {
      seed: "meadow-001",
      invite: hash(invite),
      contentVersion: CONTENT_VERSION,
      generationVersion: GENERATION_VERSION,
    };
    // Room creation is atomically published; no partially-created room is joinable.
    await this.redis
      .multi()
      .set(this.key(worldId, "meta"), JSON.stringify(meta), { EX: TTL })
      .hSet(
        this.key(worldId, "members"),
        playerId,
        JSON.stringify({ name, character, hash: hash(token) }),
      )
      .expire(this.key(worldId, "members"), TTL)
      .set(`${this.prefix}:invite:${hash(invite)}`, worldId, { EX: TTL })
      .exec();
    return {
      worldId,
      playerId,
      token,
      invite,
      seed: meta.seed,
      name,
      character,
    };
  }
  async join(
    name: string,
    invite: string,
    character: CharacterId = "fern",
  ): Promise<Session> {
    const worldId = await this.redis.get(
      `${this.prefix}:invite:${hash(invite)}`,
    );
    if (!worldId) throw Error("This invitation has expired.");
    const playerId = randomUUID(),
      token = randomBytes(32).toString("base64url");
    const ok = await this.redis.eval(
      `local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end
      local meta=cjson.decode(raw); if meta.contentVersion~=ARGV[3] or meta.generationVersion~=ARGV[4] then return 0 end
      if redis.call('HLEN',KEYS[2])>=2 then return 0 end
      redis.call('HSET',KEYS[2],ARGV[1],ARGV[2]); redis.call('EXPIRE',KEYS[2],1800); return 1`,
      {
        keys: [this.key(worldId, "meta"), this.key(worldId, "members")],
        arguments: [
          playerId,
          JSON.stringify({ name, character, hash: hash(token) }),
          CONTENT_VERSION,
          GENERATION_VERSION,
        ],
      },
    );
    if (ok !== 1) throw Error("This Meadow already has its two adventurers.");
    return {
      worldId,
      playerId,
      token,
      invite,
      seed: "meadow-001",
      name,
      character,
    };
  }
  async characters(world: string) {
    const members = await this.redis.hGetAll(this.key(world, "members"));
    return new Map(
      Object.entries(members).map(([id, raw]) => [
        id,
        characterId(JSON.parse(raw).character),
      ]),
    );
  }
  async authenticate(world: string, token: string) {
    const raw = await this.redis.get(this.key(world, "meta"));
    if (!raw || !compatible(JSON.parse(raw))) return null;
    const members = await this.redis.hGetAll(this.key(world, "members"));
    return (
      Object.entries(members).find(
        ([, raw]) => JSON.parse(raw).hash === hash(token),
      )?.[0] ?? null
    );
  }
  async attach(world: string, player: string) {
    return Number(
      await this.redis.eval(
        `local n=redis.call('HINCRBY',KEYS[1],ARGV[1],1)
      redis.call('HDEL',KEYS[2],ARGV[1]); redis.call('EXPIRE',KEYS[1],1800); return n`,
        {
          keys: [this.key(world, "generations"), this.key(world, "inputs")],
          arguments: [player],
        },
      ),
    );
  }
  async input(
    world: string,
    player: string,
    generation: number,
    seq: number,
    x: number,
    y: number,
  ) {
    return (
      Number(
        await this.redis.eval(
          `if tonumber(redis.call('HGET',KEYS[1],ARGV[1]))~=tonumber(ARGV[2]) then return 0 end
      local old=redis.call('HGET',KEYS[2],ARGV[1]); if old and cjson.decode(old).seq>=tonumber(ARGV[3]) then return 0 end
      local t=redis.call('TIME'); local at=t[1]*1000+math.floor(t[2]/1000)
      redis.call('HSET',KEYS[2],ARGV[1],cjson.encode({generation=tonumber(ARGV[2]),seq=tonumber(ARGV[3]),x=tonumber(ARGV[4]),y=tonumber(ARGV[5]),at=at}));
      redis.call('EXPIRE',KEYS[2],1800); return 1`,
          {
            keys: [this.key(world, "generations"), this.key(world, "inputs")],
            arguments: [
              player,
              String(generation),
              String(seq),
              String(x),
              String(y),
            ],
          },
        ),
      ) === 1
    );
  }
  async acquire(world: string, owner: string) {
    return Number(
      await this.redis.eval(
        `if redis.call('EXISTS',KEYS[1])==1 then return 0 end
      local epoch=redis.call('INCR',KEYS[2]); redis.call('SET',KEYS[1],ARGV[1]..':'..epoch,'PX',ARGV[2]); return epoch`,
        {
          keys: [this.key(world, "lease"), this.key(world, "epoch")],
          arguments: [owner, String(this.leaseMs)],
        },
      ),
    );
  }
  async renew(world: string, token: string) {
    return (
      Number(
        await this.redis.eval(
          `if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end redis.call('PEXPIRE',KEYS[1],ARGV[2]); return 1`,
          {
            keys: [this.key(world, "lease")],
            arguments: [token, String(this.leaseMs)],
          },
        ),
      ) === 1
    );
  }
  async release(world: string, token: string) {
    await this.redis.eval(
      `if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0`,
      { keys: [this.key(world, "lease")], arguments: [token] },
    );
  }
  async read(world: string) {
    // One atomic read also avoids separate hosted round trips for each hash.
    const values = (await this.redis.eval(
      `return {redis.call('GET',KEYS[1]) or '', redis.call('HGETALL',KEYS[2]), redis.call('HGETALL',KEYS[3]), redis.call('GET',KEYS[4]) or '', redis.call('TIME')}`,
      {
        keys: ["meta", "members", "inputs", "checkpoint"].map((key) =>
          this.key(world, key),
        ),
        arguments: [],
      },
    )) as unknown as [string, string[], string[], string, string[]];
    const [meta, memberPairs, inputPairs, checkpoint, time] = values;
    const fromPairs = (pairs: string[]) =>
      Object.fromEntries(
        Array.from({ length: pairs.length / 2 }, (_, i) => [
          pairs[i * 2],
          pairs[i * 2 + 1],
        ]),
      );
    const members = fromPairs(memberPairs),
      inputs = fromPairs(inputPairs);
    const t = time as unknown as string[];
    return {
      meta: meta ? (JSON.parse(meta) as Metadata) : null,
      members: Object.entries(members).map(([id, raw]) => ({
        id,
        name: JSON.parse(raw).name as string,
        character: characterId(JSON.parse(raw).character),
      })),
      inputs: Object.fromEntries(
        Object.entries(inputs).map(([id, raw]) => [
          id,
          JSON.parse(raw) as Presence,
        ]),
      ),
      checkpoint: checkpoint ? (JSON.parse(checkpoint) as Checkpoint) : null,
      now: Number(t[0]) * 1000 + Number(t[1]) / 1000,
    };
  }
  async commit(
    world: string,
    token: string,
    checkpoint: Checkpoint,
    projection: string | null,
  ) {
    return (
      Number(
        await this.redis.eval(
          `if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
      redis.call('SET',KEYS[2],ARGV[2],'EX',1800)
      for i=3,6 do redis.call('EXPIRE',KEYS[i],1800) end
      if ARGV[3]~='' then redis.call('PUBLISH',KEYS[7],ARGV[3]) end return 1`,
          {
            keys: [
              "lease",
              "checkpoint",
              "meta",
              "members",
              "generations",
              "inputs",
              "snapshots",
            ].map((k) => this.key(world, k)),
            arguments: [token, JSON.stringify(checkpoint), projection ?? ""],
          },
        ),
      ) === 1
    );
  }
}
