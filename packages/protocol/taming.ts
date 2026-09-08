import { z } from "zod";
import { pointSchema } from "./combat";
const tick = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const companionCommandSchema = z
  .object({
    seq: tick.min(1),
    target: z.string().min(1).max(200),
    action: z.enum([
      "feed",
      "follow",
      "stay",
      "recall",
      "dissolve",
      "teleport",
      "friendly-fire",
    ]),
  })
  .strict();
export type CompanionCommand = z.infer<typeof companionCommandSchema>;
export const companionReceiptSchema = companionCommandSchema
  .extend({
    tick,
    result: z.enum([
      "teleported",
      "settings-updated",
      "channeling",
      "opened",
      "already-open",
      "cancelled",
      "fed",
      "tamed",
      "following",
      "staying",
      "recovering",
      "claimed",
      "owned",
      "already-companion",
      "food",
      "range",
      "blocked",
      "dead",
      "busy",
      "cooldown",
      "missing",
      "forbidden",
    ]),
  })
  .strict();
export type CompanionReceipt = z.infer<typeof companionReceiptSchema>;
export const mossSchema = z
  .object({
    id: z.string().max(200),
    kind: z.literal("moss-slime"),
    position: pointSchema,
    home: pointSchema,
    owner: z.string().max(100).nullable(),
    claim: z
      .object({ player: z.string().max(100), expires: tick })
      .strict()
      .nullable(),
    feeds: z.number().int().min(0).max(3),
    mode: z.enum(["curious", "follow", "stay", "recovering"]),
    facing: z.number().int().min(0).max(7),
    moving: z.boolean(),
    fedTick: tick,
  })
  .strict();
export type Moss = z.infer<typeof mossSchema>;
