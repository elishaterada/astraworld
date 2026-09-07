import { z } from "zod";
import { CONTENT_VERSION, GENERATION_VERSION } from "../world";
import { CHARACTER_IDS, type CharacterId } from "../characters";
export const characterSchema = z.enum(CHARACTER_IDS);
export const VERSION = 1;
export const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const id = z.string().uuid();
export const credential = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const name = z
  .string()
  .min(2)
  .max(20)
  .regex(/^[\p{L}\p{N} _'’-]+$/u);
export const vector = z
  .object({
    x: z.number().finite().min(-1).max(1),
    y: z.number().finite().min(-1).max(1),
  })
  .strict();
const envelope = { protocolVersion: z.literal(VERSION), worldId: id };
export const clientMessage = z.discriminatedUnion("type", [
  z
    .object({
      ...envelope,
      type: z.literal("hello"),
      token: credential,
      characters: z.literal(true).optional(),
      contentVersion: z.literal(CONTENT_VERSION),
      generationVersion: z.literal(GENERATION_VERSION),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal("input"),
      generation: integer,
      seq: integer,
      movement: vector,
    })
    .strict(),
  z.object({ ...envelope, type: z.literal("resync") }).strict(),
]);
export const actorSchema = z
  .object({
    id,
    name,
    character: characterSchema.optional(),
    position: z
      .object({
        x: z.number().finite().min(0).max(128),
        y: z.number().finite().min(0).max(128),
      })
      .strict(),
    generation: integer,
    ack: integer,
  })
  .strict();
export type Actor = z.infer<typeof actorSchema>;
export const snapshotSchema = z
  .object({
    ...envelope,
    type: z.literal("snapshot"),
    full: z.literal(true),
    seed: z.string().max(64),
    contentVersion: z.literal(CONTENT_VERSION),
    generationVersion: z.literal(GENERATION_VERSION),
    epoch: integer,
    tick: integer,
    owner: z.string().max(100),
    selfId: id,
    actors: z.array(actorSchema).max(2),
  })
  .strict();
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Session = {
  durable?: boolean;
  worldId: string;
  token: string;
  playerId: string;
  invite: string;
  seed: string;
  name: string;
  character?: CharacterId;
};
export const joinSchema = z
  .object({
    name,
    invite: credential.optional(),
    character: characterSchema.default("fern"),
  })
  .strict();
/** Strictly bounded and shared, including rejection of invented authoritative fields. */
export function parseClient(raw: string) {
  if (new TextEncoder().encode(raw).length > 8192) return null;
  try {
    const r = clientMessage.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
