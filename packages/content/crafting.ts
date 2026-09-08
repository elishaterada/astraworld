import { z } from "zod";
export const STONE_AXE_RECIPE = {
  id: "stone-axe",
  inputs: { wood: 3, stone: 2 },
  output: "stone-axe",
} as const;
export const WORKBENCH_COST = 6;
// Camp alcoves leave the spawn, cross-map trails, seating and Forest gate clear.
export const WORKBENCH_PLOTS = [
  { id: "camp-north", x: 69.5, y: 68.5 },
  { id: "camp-south", x: 69.5, y: 72.5 },
] as const;
export const benchesSchema = z
  .array(
    z
      .object({
        id: z.enum(["camp-north", "camp-south"]),
        owner: z.string().min(1).max(100),
        x: z.number().finite(),
        y: z.number().finite(),
      })
      .strict()
      .refine((b) =>
        WORKBENCH_PLOTS.some(
          (p) => p.id === b.id && p.x === b.x && p.y === b.y,
        ),
      ),
  )
  .max(2)
  .refine((bs) => new Set(bs.map((b) => b.id)).size === bs.length);

export type Workbench = z.infer<typeof benchesSchema>[number];
