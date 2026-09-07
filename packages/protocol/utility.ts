import { z } from "zod";
const tick = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const gateSchema = z
  .object({
    id: z.string().max(200),
    tag: z.literal("dissolvable-vines"),
    open: z.boolean(),
    openedTick: tick.nullable(),
    channel: z
      .object({
        player: z.string().max(100),
        companion: z.string().max(200),
        generation: tick,
        seq: tick,
        startedTick: tick,
        endsTick: tick,
      })
      .strict()
      .nullable(),
  })
  .strict();
export type Gate = z.infer<typeof gateSchema>;
