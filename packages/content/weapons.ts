import { z } from "zod";
import { bladeAttack } from "./combat";
export const weaponSchema = z.enum([
  "blade",
  "fists",
  "greatsword",
  "bow",
  "magic",
]);
export type Weapon = z.infer<typeof weaponSchema>;
export const WEAPONS: Record<
  Weapon,
  { name: string; skill: string; cooldown: number; description: string }
> = {
  blade: {
    name: "Blade",
    skill: "Cleave",
    cooldown: 240,
    description: "A sweeping cut around you.",
  },
  fists: {
    name: "Fists",
    skill: "Palm Burst",
    cooldown: 180,
    description: "A forceful palm strike that pushes enemies back.",
  },
  greatsword: {
    name: "Greatsword",
    skill: "Quake",
    cooldown: 360,
    description: "A heavy ground slam around you.",
  },
  bow: {
    name: "Bow",
    skill: "Volley",
    cooldown: 300,
    description: "Three arrows in a spreading fan.",
  },
  magic: {
    name: "Magic",
    skill: "Nova",
    cooldown: 360,
    description: "A burst of magic around you.",
  },
};
export type AttackProfile = {
  windup: number;
  active: number;
  recovery: number;
  damage: number;
  range: number;
  knockback: number;
  projectile: boolean;
  spread: number[];
  radial: boolean;
};
export function weaponAttack(
  weapon: Weapon = "blade",
  combo = 0,
  charge = 0,
  skill = false,
): AttackProfile {
  let base: AttackProfile = {
    ...bladeAttack(combo),
    projectile: false,
    spread: [0],
    radial: false,
  };
  if (weapon === "fists")
    base = {
      ...base,
      windup: 5,
      active: 5,
      recovery: 14,
      damage: 6,
      range: 1.2,
      knockback: 0,
    };
  if (weapon === "greatsword")
    base = {
      ...base,
      windup: 18,
      active: 8,
      recovery: 28,
      damage: 18,
      range: 2.1,
      knockback: 0.7,
    };
  if (weapon === "bow")
    base = {
      ...base,
      windup: 10,
      active: 30,
      recovery: 12,
      damage: 10,
      range: 9,
      knockback: 0,
      projectile: true,
    };
  if (weapon === "magic")
    base = {
      ...base,
      windup: 14,
      active: 30,
      recovery: 16,
      damage: 12,
      range: 8,
      knockback: 0,
      projectile: true,
    };
  if (skill) {
    if (weapon === "bow")
      base = { ...base, damage: 12, spread: [-0.24, 0, 0.24] };
    else if (weapon === "fists")
      base = { ...base, damage: 16, range: 2.2, knockback: 1.4 };
    else
      base = {
        ...base,
        windup: 18,
        active: 8,
        recovery: 24,
        damage: weapon === "greatsword" ? 24 : 18,
        range: weapon === "magic" ? 3.5 : 2.6,
        radial: true,
        projectile: false,
        knockback: 0.8,
      };
  }
  // Skills have fixed power; holding charge cannot bypass their tuning.
  const power = skill ? 0 : Math.max(0, Math.min(1, charge));
  return {
    ...base,
    damage: Math.round(base.damage * (1 + power)),
    knockback: base.knockback + power * 0.6,
  };
}
export const BLOCK = { parryTicks: 7, rearmTicks: 30, chip: 0.25 };
export const CHARGE_TICKS = 60;
