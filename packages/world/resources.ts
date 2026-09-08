import { type World, seedHash } from "./index";
export type ResourceNode = {
  id: string;
  kind: "berry-bush" | "tree" | "loose-stone";
  x: number;
  y: number;
};
export const CURIOUS_SLOTS = [
  { x: 61.5, y: 64.5 },
  { x: 64.5, y: 68.5 },
] as const;
/** Independent resource stream; trees reuse the baseline solid footprint. */
export function resourceNodes(world: World): ResourceNode[] {
  const existing: ResourceNode[] = world.tiles.flatMap((t) => {
    const guaranteed = (t.x === 65 && t.y === 63) || (t.x === 63 && t.y === 65);
    const berry =
      guaranteed ||
      (!t.blocker &&
        t.terrain === "grass" &&
        seedHash(`berries:${t.id}`) % 67 === 0);
    return t.blocker === "tree" || berry
      ? [
          {
            id: `resource:${t.id}`,
            kind:
              t.blocker === "tree"
                ? ("tree" as const)
                : ("berry-bush" as const),
            x: t.x + 0.5,
            y: t.y + 0.5,
          },
        ]
      : [];
  });
  return [
    ...existing,
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `stone:${world.seed}:${i}`,
      kind: "loose-stone" as const,
      x: 68.5 + i * 2,
      y: 64.5,
    })),
  ];
}
