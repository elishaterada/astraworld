import { z } from "zod";
const tick = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const pointSchema = z
  .object({ x: z.number().min(0).max(128), y: z.number().min(0).max(128) })
  .strict();
export const combatSchema = z
  .object({
    health: z.number().int().min(0).max(100),
    spawn: pointSchema,
    attack: z
      .object({
        startedTick: tick,
        facing: z.number().int().min(0).max(7),
        hits: z.array(z.string().max(200)).max(1),
      })
      .strict()
      .nullable(),
    attackReady: tick,
    dodgeUntil: tick,
    dodgeReady: tick,
    dodgeSteps: z.number().int().min(0).max(15),
    dodgeFacing: z.number().int().min(0).max(7),
    invulnerableUntil: tick,
    respawnAt: tick,
    damageTick: tick,
    deaths: tick,
  })
  .strict();
export type CombatState = z.infer<typeof combatSchema>;
export const slimeSchema = z
  .object({
    id: z.string().max(200),
    kind: z.literal("hostile-slime"),
    position: pointSchema,
    home: pointSchema,
    health: z.number().int().min(0).max(30),
    phase: z.enum(["idle", "chase", "tell", "recover", "return", "dead"]),
    phaseTick: tick,
    target: z.string().max(100).nullable(),
    impact: pointSchema,
    damageTick: tick,
    deathTick: tick.nullable(),
  })
  .strict();
export type Slime = z.infer<typeof slimeSchema>;
