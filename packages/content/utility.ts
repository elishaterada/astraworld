import { z } from "zod";
export const DISSOLVE = z
  .object({
    id: z.literal("dissolve-vines"),
    tag: z.literal("dissolvable-vines"),
    range: z.number().positive(),
    actorRange: z.number().positive(),
    channelTicks: z.number().int().positive(),
    cooldownTicks: z.number().int().positive(),
  })
  .strict()
  .parse({
    id: "dissolve-vines",
    tag: "dissolvable-vines",
    range: 2,
    actorRange: 3,
    channelTicks: 60,
    cooldownTicks: 120,
  });
