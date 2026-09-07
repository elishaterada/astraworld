import { z } from "zod";
export const TAMING = z
  .object({
    id: z.literal("moss-slime"),
    food: z.literal("sweet-berry"),
    feeds: z.literal(3),
    claimTicks: z.number().int().positive(),
    controlCooldown: z.number().int().positive(),
    feedCooldown: z.number().int().positive(),
    range: z.number().positive(),
    speed: z.number().positive(),
    followDistance: z.number().positive(),
    recallDistance: z.number().positive(),
    stuckTicks: z.number().int().positive(),
    repathTicks: z.number().int().positive(),
  })
  .strict()
  .parse({
    id: "moss-slime",
    food: "sweet-berry",
    feeds: 3,
    claimTicks: 3600,
    feedCooldown: 60,
    controlCooldown: 30,
    range: 1.5,
    speed: 4.4,
    followDistance: 1.7,
    recallDistance: 12,
    stuckTicks: 180,
    repathTicks: 12,
  });
