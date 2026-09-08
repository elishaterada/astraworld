import { z } from "zod";
const ticks = z.number().int().positive();
export const COMBAT = z
  .object({
    playerHealth: ticks,
    bladeDamage: ticks,
    windup: ticks,
    active: ticks,
    recovery: ticks,
    bladeRange: z.number().positive(),
    dodgeTicks: ticks,
    invulnerableTicks: ticks,
    dodgeCooldown: ticks,
    dodgeSpeed: z.number().positive(),
    respawnTicks: ticks,
    spawnProtection: ticks,
    slimeHealth: ticks,
    slimeDamage: ticks,
    tellTicks: ticks,
    slimeRecovery: ticks,
    slamRadius: z.number().positive(),
    acquireRange: z.number().positive(),
    leash: z.number().positive(),
    slimeSpeed: z.number().positive(),
  })
  .strict()
  .parse({
    playerHealth: 100,
    bladeDamage: 10,
    windup: 9,
    active: 6,
    recovery: 21,
    bladeRange: 1.65,
    dodgeTicks: 15,
    invulnerableTicks: 9,
    dodgeCooldown: 60,
    dodgeSpeed: 10,
    respawnTicks: 120,
    spawnProtection: 120,
    slimeHealth: 30,
    slimeDamage: 10,
    tellTicks: 30,
    slimeRecovery: 45,
    slamRadius: 1.3,
    acquireRange: 6,
    leash: 8,
    slimeSpeed: 2,
  });

/** A short chain window rewards sustained pressure; the finisher commits for longer. */
export const COMBO_WINDOW = 48;
export function bladeAttack(combo = 0) {
  return combo === 2
    ? {
        windup: 12,
        active: 8,
        recovery: 22,
        damage: 15,
        range: 1.9,
        knockback: 1.1,
      }
    : {
        windup: COMBAT.windup,
        active: COMBAT.active,
        recovery: combo === 1 ? 15 : COMBAT.recovery,
        damage: COMBAT.bladeDamage,
        range: COMBAT.bladeRange,
        knockback: 0,
      };
}
