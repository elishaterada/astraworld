import { benchesSchema } from "../../packages/content/crafting";
import { Pool } from "pg";
import { createHash } from "node:crypto";
import { z } from "zod";
import { progressSchema } from "../../packages/content";
import {
  companionReceiptSchema,
  mossSchema,
} from "../../packages/protocol/taming";
import { gateSchema } from "../../packages/protocol/utility";
import { realtimeActorSchema } from "../../packages/protocol/realtime";
import { slimeSchema } from "../../packages/protocol/combat";
import { compatible, type Metadata } from "./store";
const stateSchema = z
  .object({
    tick: z.number().int().nonnegative(),
    actors: z.array(realtimeActorSchema).max(8),
    gathering: z.object({
      players: z.record(z.string(), progressSchema),
      depleted: z.array(z.string()).max(16384),
      benches: benchesSchema.optional(),
    }),
    rules: z.object({ friendlyFire: z.boolean() }).strict().optional(),
    slime: slimeSchema.optional(),
    monsters: z.array(slimeSchema).max(5).optional(),
    taming: z
      .object({
        travelReady: z
          .record(z.string(), z.number().int().nonnegative())
          .optional(),
        gate: gateSchema,
        creatures: z.array(mossSchema.passthrough()).max(8),
        receipts: z.record(z.string(), companionReceiptSchema),
      })
      .optional(),
  })
  .passthrough();
export type DurableState = z.infer<typeof stateSchema>;
export type DurableCommand = {
  actor: string;
  stream: "gather" | "companion";
  result:
    | NonNullable<DurableState["gathering"]["players"][string]["receipt"]>
    | import("../../packages/protocol/taming").CompanionReceipt;
};
export function receipts(state: DurableState): DurableCommand[] {
  return [
    ...Object.entries(state.gathering.players).flatMap(([actor, p]) =>
      p.receipt
        ? [{ actor, stream: "gather" as const, result: p.receipt }]
        : [],
    ),
    ...Object.entries(state.taming?.receipts ?? {}).map(([actor, result]) => ({
      actor,
      stream: "companion" as const,
      result,
    })),
  ];
}
export type DurableMember = {
  id: string;
  name: string;
  character: string;
  hash: string;
  spawnIndex: number;
};
const digestCanonical = (v: object) =>
  JSON.stringify(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
const digest = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function valuableDigest(s: DurableState) {
  return digest({
    rules: s.rules,
    loadouts: s.actors.map((a) => ({
      id: a.id,
      weapon: a.combat?.weapon ?? "blade",
    })),
    gathering: s.gathering,
    taming: s.taming
      ? {
          travelReady: s.taming.travelReady,
          gate: s.taming.gate,
          receipts: s.taming.receipts,
          creatures: s.taming.creatures.map((m) => ({
            id: m.id,
            owner: m.owner,
            feeds: m.feeds,
            claim: m.claim,
            mode: m.mode === "stay" ? "stay" : "follow",
          })),
        }
      : null,
    defeated: s.slime?.health === 0,
    monsters: s.monsters?.map((m) => ({ id: m.id, defeated: m.health === 0 })),
  });
}
export class DurableStore {
  readonly pool: Pool;
  constructor(
    url: string,
    readonly namespace: string,
  ) {
    if (!/^(local|test|preview|production):[a-zA-Z0-9_-]+$/.test(namespace))
      throw Error("Use an explicit environment namespace");
    this.pool = new Pool({
      connectionString: url,
      max: 2,
      connectionTimeoutMillis: 5000,
      query_timeout: 6000,
      idleTimeoutMillis: 10000,
    });
    this.pool.on("error", () => {});
  }
  async close() {
    await this.pool.end();
  }
  async ready() {
    const r = await this.pool.query(
      "SELECT version FROM astraworld.schema_migrations WHERE version=1",
    );
    if (r.rowCount !== 1) throw Error("Database migration required");
  }
  async create(id: string, metadata: Metadata, member: DurableMember) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(
        "INSERT INTO astraworld.worlds(namespace,id,metadata) VALUES($1,$2,$3)",
        [this.namespace, id, metadata],
      );
      await c.query(
        "INSERT INTO astraworld.members(namespace,world_id,id,token_hash,name,character,spawn_index) VALUES($1,$2,$3,$4,$5,$6,0)",
        [
          this.namespace,
          id,
          member.id,
          member.hash,
          member.name,
          member.character,
        ],
      );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async join(inviteHash: string, member: DurableMember) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const w = (
        await c.query(
          "SELECT id,metadata FROM astraworld.worlds WHERE namespace=$1 AND metadata->>'invite'=$2 FOR UPDATE",
          [this.namespace, inviteHash],
        )
      ).rows[0];
      if (!w || !compatible(w.metadata)) throw Error("Invitation unavailable");
      const count = Number(
        (
          await c.query(
            "SELECT count(*) FROM astraworld.members WHERE namespace=$1 AND world_id=$2",
            [this.namespace, w.id],
          )
        ).rows[0].count,
      );
      if (count >= 8) throw Error("This Meadow is full (8 adventurers).");
      await c.query(
        "INSERT INTO astraworld.members(namespace,world_id,id,token_hash,name,character,spawn_index) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          this.namespace,
          w.id,
          member.id,
          member.hash,
          member.name,
          member.character,
          count,
        ],
      );
      await c.query("COMMIT");
      return {
        worldId: w.id,
        metadata: w.metadata as Metadata,
        member: { ...member, spawnIndex: count },
      };
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async load(id: string): Promise<{
    metadata: Metadata;
    state: DurableState | null;
    revision: number;
    epoch: number;
    digest: string | null;
    members: DurableMember[];
  } | null> {
    const w = (
      await this.pool.query(
        "SELECT metadata,state,revision,epoch,digest FROM astraworld.worlds WHERE namespace=$1 AND id=$2",
        [this.namespace, id],
      )
    ).rows[0];
    if (!w) return null;
    const members = (
      await this.pool.query(
        'SELECT id,name,character,token_hash AS hash,spawn_index AS "spawnIndex" FROM astraworld.members WHERE namespace=$1 AND world_id=$2 ORDER BY spawn_index',
        [this.namespace, id],
      )
    ).rows as DurableMember[];
    return {
      ...w,
      revision: Number(w.revision),
      epoch: Number(w.epoch),
      members,
      state: w.state ? stateSchema.parse(w.state) : null,
    };
  }
  async claim(id: string, token: string) {
    const row = (
      await this.pool.query(
        "UPDATE astraworld.worlds SET owner_token=$3,epoch=epoch+1 WHERE namespace=$1 AND id=$2 RETURNING epoch",
        [this.namespace, id, token],
      )
    ).rows[0];
    if (!row) throw Error("Durable world missing");
    return Number(row.epoch);
  }
  async commit(
    id: string,
    token: string,
    expected: number,
    raw: unknown,
    journal: DurableCommand[] = [],
  ) {
    const state = stateSchema.parse(raw);
    const owners =
      state.taming?.creatures.flatMap((m) => (m.owner ? [m.owner] : [])) ?? [];
    if (new Set(owners).size !== owners.length)
      throw Error("Duplicate companion owner");
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const row = (
        await c.query(
          "SELECT owner_token,revision,state FROM astraworld.worlds WHERE namespace=$1 AND id=$2 FOR UPDATE",
          [this.namespace, id],
        )
      ).rows[0];
      if (
        !row ||
        row.owner_token !== token ||
        Number(row.revision) !== expected
      )
        throw Error("Durable owner/revision fenced");
      if (row.state?.taming?.gate.open && !state.taming?.gate.open)
        throw Error("Gate cannot close");
      const revision = expected + 1;
      const members = new Set(
        (
          await c.query(
            "SELECT id FROM astraworld.members WHERE namespace=$1 AND world_id=$2",
            [this.namespace, id],
          )
        ).rows.map((m) => m.id),
      );
      if (
        [
          ...Object.keys(state.gathering.players),
          ...state.actors.map((a) => a.id),
          ...owners,
          ...(state.gathering.benches ?? []).map((b) => b.owner),
        ].some((id) => !members.has(id))
      )
        throw Error("State contains a non-member");
      for (const [actor, p] of Object.entries(
        row.state?.gathering?.players ?? {},
      ) as [string, DurableState["gathering"]["players"][string]][]) {
        if (
          !state.gathering.players[actor] ||
          (state.gathering.players[actor].receipt?.seq ?? 0) <
            (p.receipt?.seq ?? 0)
        )
          throw Error("Character progress cannot regress");
      }
      for (const m of row.state?.taming?.creatures ?? [])
        if (
          m.owner &&
          !state.taming?.creatures.some(
            (next) => next.id === m.id && next.owner === m.owner,
          )
        )
          throw Error("Companion ownership cannot regress");
      for (const m of [row.state?.slime, ...(row.state?.monsters ?? [])])
        if (
          m &&
          m.health === 0 &&
          ![state.slime, ...(state.monsters ?? [])].some(
            (next) => !!next && next.id === m.id && next.health === 0,
          )
        )
          throw Error("Monster defeat cannot regress");
      for (const b of row.state?.gathering?.benches ?? [])
        if (
          !state.gathering.benches?.some(
            (next) =>
              next.id === b.id &&
              next.owner === b.owner &&
              next.x === b.x &&
              next.y === b.y,
          )
        )
          throw Error("Workbench placement cannot regress");
      for (const node of row.state?.gathering?.depleted ?? [])
        if (!state.gathering.depleted.includes(node))
          throw Error("Depletion cannot regress");
      const commands = new Map<
        string,
        {
          actor: string;
          stream: string;
          seq: number;
          request_hash: string;
          result: object;
        }
      >();
      for (const { stream, actor, result } of [
        ...journal,
        ...receipts(state),
      ]) {
        const checked =
          stream === "gather"
            ? progressSchema.shape.receipt.unwrap().parse(result)
            : companionReceiptSchema.parse(result);
        const request_hash = digest({
          target: checked.target,
          action: "action" in checked ? checked.action : "gather",
        });
        const key = `${actor}:${stream}:${checked.seq}`;
        if (
          commands.has(key) &&
          commands.get(key)!.request_hash !== request_hash
        )
          throw Error("Command payload conflict");
        commands.set(key, {
          actor,
          stream,
          seq: checked.seq,
          request_hash,
          result: checked,
        });
      }
      const payload = JSON.stringify([...commands.values()]);
      const existing = (
        await c.query(
          `SELECT c.actor_id,c.stream,c.seq,c.request_hash,c.result FROM astraworld.commands c
        JOIN jsonb_to_recordset($3::jsonb) AS x(actor uuid,stream text,seq bigint) ON c.actor_id=x.actor AND c.stream=x.stream AND c.seq=x.seq
        WHERE c.namespace=$1 AND c.world_id=$2`,
          [this.namespace, id, payload],
        )
      ).rows;
      for (const old of existing) {
        const next = commands.get(`${old.actor_id}:${old.stream}:${old.seq}`)!;
        if (
          old.request_hash !== next.request_hash ||
          (old.result.result !== "channeling" &&
            digestCanonical(old.result) !== digestCanonical(next.result))
        )
          throw Error("Command payload/result conflict");
      }
      await c.query(
        `INSERT INTO astraworld.commands(namespace,world_id,actor_id,stream,seq,request_hash,result,revision)
        SELECT $1,$2,x.actor,x.stream,x.seq,x.request_hash,x.result,$4 FROM jsonb_to_recordset($3::jsonb) AS x(actor uuid,stream text,seq bigint,request_hash text,result jsonb)
        ON CONFLICT(namespace,world_id,actor_id,stream,seq) DO UPDATE SET result=EXCLUDED.result,revision=EXCLUDED.revision
        WHERE astraworld.commands.result IS DISTINCT FROM EXCLUDED.result`,
        [this.namespace, id, payload, revision],
      );
      await c.query(
        "UPDATE astraworld.worlds SET state=$3,revision=$4,digest=$5,updated_at=now() WHERE namespace=$1 AND id=$2",
        [this.namespace, id, state, revision, valuableDigest(state)],
      );
      await c.query(
        "INSERT INTO astraworld.outbox(namespace,world_id,revision,payload) VALUES($1,$2,$3,$4)",
        [this.namespace, id, revision, state],
      );
      await c.query("COMMIT");
      return revision;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async published(id: string, revision: number) {
    await this.pool.query(
      "UPDATE astraworld.outbox SET published_at=now() WHERE namespace=$1 AND world_id=$2 AND revision<=$3 AND published_at IS NULL",
      [this.namespace, id, revision],
    );
  }
}
