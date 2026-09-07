/** Cosmetic definitions only. No movement, permissions or gameplay statistics. */
export const CHARACTER_IDS = ["fern", "ember", "iris", "hazel"] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];
export const CHARACTERS = {
  fern: { label: "Fern", color: "#9cdbad", mark: "●" },
  ember: { label: "Ember", color: "#f0ac79", mark: "◆" },
  iris: { label: "Iris", color: "#c2aff0", mark: "✦" },
  hazel: { label: "Hazel", color: "#edc66d", mark: "■" },
} as const;
export function characterId(value: unknown): CharacterId {
  return CHARACTER_IDS.includes(value as CharacterId)
    ? (value as CharacterId)
    : "fern";
}
