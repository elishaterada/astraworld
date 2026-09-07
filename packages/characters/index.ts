/** Cosmetic definitions only. No movement, permissions or gameplay statistics. */
export const CHARACTER_IDS = ["fern", "ember", "iris"] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];
export const CHARACTERS = {
  fern: { label: "Fern", tint: 0xa7efb7, color: "#9cdbad", mark: "●" },
  ember: { label: "Ember", tint: 0xffba87, color: "#f0ac79", mark: "◆" },
  iris: { label: "Iris", tint: 0xc5b5ff, color: "#c2aff0", mark: "✦" },
} as const;
export function characterId(value: unknown): CharacterId {
  return CHARACTER_IDS.includes(value as CharacterId)
    ? (value as CharacterId)
    : "fern";
}
