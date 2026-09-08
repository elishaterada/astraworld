import { weaponSchema } from "../content/weapons";
import { benchesSchema } from "../content/crafting";
import { gateSchema } from "./utility";
import {
  companionCommandSchema,
  companionReceiptSchema,
  mossSchema,
} from "./taming";
import { combatSchema, slimeSchema } from "./combat";
import { gatherCommandSchema, progressSchema } from "../content";
import { MAX_PLAYERS } from "./capacity";
import { z } from "zod";
import { id, integer, credential, characterSchema, name } from "./index";
import { CONTENT_VERSION, GENERATION_VERSION } from "../world";
export const REALTIME_VERSION = 6;
export const HZ = 60;
export const DT = 1 / HZ;
const envelope = { protocolVersion: z.literal(REALTIME_VERSION), worldId: id };
export const controls = {
  keys: z.number().int().min(0).max(31),
  facing: z.number().int().min(0).max(7),
};
export const runSchema = z
  .object({
    seq: integer.min(1),
    count: z.number().int().min(1).max(60),
    ...controls,
    wave: z.literal(true).optional(),
    attack: z.literal(true).optional(),
    dodge: z.literal(true).optional(),
    charge: z.boolean().optional(),
    block: z.boolean().optional(),
    skill: z.literal(true).optional(),
    cancel: z.literal(true).optional(),
    weapon: weaponSchema.optional(),
  })
  .strict();
export const packetSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...envelope,
      type: z.literal("hello"),
      token: credential,
      qol: z.literal(true).optional(),
      contentVersion: z.literal(CONTENT_VERSION),
      generationVersion: z.literal(GENERATION_VERSION),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal("frames"),
      generation: integer.min(1),
      runs: z.array(runSchema).max(60),
      gather: gatherCommandSchema.optional(),
      companion: companionCommandSchema.optional(),
    })
    .strict(),
]);
export type Run = z.infer<typeof runSchema>;
export type Frame = Omit<Run, "count">;
export const actionSchema = z
  .object({
    kind: z.enum(["wave", "gather", "attack", "dodge"]),
    resource: z.enum(["tree", "berry-bush", "loose-stone"]).optional(),
    seq: integer,
    generation: integer,
    startedTick: integer,
  })
  .strict();
export const realtimeActorSchema = z
  .object({
    id,
    name,
    character: characterSchema,
    position: z
      .object({
        x: z.number().finite().min(0).max(128),
        y: z.number().finite().min(0).max(128),
      })
      .strict(),
    generation: integer,
    ack: integer,
    facing: controls.facing,
    moving: z.boolean(),
    action: actionSchema.nullable(),
    combat: combatSchema.optional(),
  })
  .strict();
export type RealtimeActor = z.infer<typeof realtimeActorSchema>;
export const realtimeSnapshotSchema = z
  .object({
    ...envelope,
    type: z.literal("snapshot"),
    seed: z.string().max(64),
    epoch: integer.min(1),
    tick: integer,
    owner: z.string().max(100),
    selfId: id,
    actors: z.array(realtimeActorSchema).max(MAX_PLAYERS),
    roster: z
      .array(
        realtimeActorSchema.pick({
          id: true,
          name: true,
          character: true,
          position: true,
        }),
      )
      .max(MAX_PLAYERS)
      .optional(),
    progress: progressSchema.optional(),
    benches: benchesSchema.optional(),
    rules: z.object({ friendlyFire: z.boolean() }).strict().optional(),
    creatorId: id.optional(),
    slime: slimeSchema.optional(),
    monsters: z.array(slimeSchema).max(5).optional(),
    gate: gateSchema.optional(),
    moss: z.array(mossSchema).max(8).optional(),
    companionReceipt: companionReceiptSchema.optional(),
    depleted: z
      .string()
      .max(4096)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/)
      .optional(),
  })
  .strict();
export type RealtimeSnapshot = z.infer<typeof realtimeSnapshotSchema>;
export function parsePacket(raw: string) {
  if (new TextEncoder().encode(raw).length > 8192) return null;
  try {
    const parsed = packetSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    if (parsed.data.type === "frames") {
      let end = 0,
        total = 0;
      for (const run of parsed.data.runs) {
        if (run.seq <= end || run.seq + run.count > Number.MAX_SAFE_INTEGER)
          return null;
        end = run.seq + run.count - 1;
        total += run.count;
      }
      if (total > 60) return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
export function packFrames(frames: Frame[]): Run[] {
  const runs: Run[] = [];
  for (const f of frames) {
    const last = runs.at(-1);
    if (
      last &&
      !f.wave &&
      !f.attack &&
      !f.dodge &&
      !f.cancel &&
      !f.skill &&
      !f.weapon &&
      !last.wave &&
      !last.attack &&
      !last.dodge &&
      !last.cancel &&
      !last.skill &&
      !last.weapon &&
      f.charge === last.charge &&
      f.block === last.block &&
      last.count < 60 &&
      last.seq + last.count === f.seq &&
      last.keys === f.keys &&
      last.facing === f.facing
    )
      last.count++;
    else runs.push({ ...f, count: 1 });
  }
  return runs;
}
