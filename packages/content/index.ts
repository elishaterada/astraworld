import { z } from "zod";
const itemSchema = z
  .object({
    id: z.enum(["sweet-berry", "wood", "hatchet", "starter-blade"]),
    schemaVersion: z.literal(1),
    displayName: z.string().min(1),
    stackMax: z.number().int().positive().max(99),
    tags: z.array(z.string()),
    iconId: z.enum(["berry", "wood", "hatchet", "blade"]),
  })
  .strict();
const resourceSchema = z
  .object({
    id: z.enum(["berry-bush", "tree"]),
    schemaVersion: z.literal(1),
    toolRequirement: itemSchema.shape.id.nullable(),
    gatherDuration: z.literal(30),
    yields: z
      .object({
        item: itemSchema.shape.id,
        quantity: z.number().int().positive().max(99),
      })
      .strict(),
    collisionFootprint: z.union([z.literal(0), z.literal(1)]),
    visualId: z.enum(["berry-bush", "tree"]),
  })
  .strict();
export function validateContent(raw: unknown) {
  const data = z
    .object({ items: z.array(itemSchema), resources: z.array(resourceSchema) })
    .strict()
    .parse(raw);
  for (const entries of [data.items, data.resources])
    if (new Set(entries.map((e) => e.id)).size !== entries.length)
      throw Error("Duplicate content ID");
  for (const r of data.resources)
    for (const id of [r.toolRequirement, r.yields.item])
      if (id && !data.items.some((i) => i.id === id))
        throw Error("Dangling item reference");
  return data;
}
export const CONTENT = validateContent({
  items: [
    {
      id: "sweet-berry",
      schemaVersion: 1,
      displayName: "Sweet Berries",
      stackMax: 99,
      tags: ["food"],
      iconId: "berry",
    },
    {
      id: "wood",
      schemaVersion: 1,
      displayName: "Wood",
      stackMax: 99,
      tags: ["material"],
      iconId: "wood",
    },
    {
      id: "hatchet",
      schemaVersion: 1,
      displayName: "Starter Hatchet",
      stackMax: 1,
      tags: ["tool"],
      iconId: "hatchet",
    },
    {
      id: "starter-blade",
      schemaVersion: 1,
      displayName: "Starter Blade",
      stackMax: 1,
      tags: ["tool"],
      iconId: "blade",
    },
  ],
  resources: [
    {
      id: "berry-bush",
      schemaVersion: 1,
      toolRequirement: null,
      gatherDuration: 30,
      yields: { item: "sweet-berry", quantity: 3 },
      collisionFootprint: 0,
      visualId: "berry-bush",
    },
    {
      id: "tree",
      schemaVersion: 1,
      toolRequirement: "hatchet",
      gatherDuration: 30,
      yields: { item: "wood", quantity: 3 },
      collisionFootprint: 1,
      visualId: "tree",
    },
  ],
});
export type ItemId = z.infer<typeof itemSchema>["id"];
export const itemDefinition = (id: ItemId) =>
  CONTENT.items.find((i) => i.id === id)!;
export const gatherCommandSchema = z
  .object({
    seq: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    target: z.string().min(1).max(512),
  })
  .strict();
export type GatherCommand = z.infer<typeof gatherCommandSchema>;
export const slotSchema = z
  .object({
    item: itemSchema.shape.id,
    quantity: z.number().int().positive().max(99),
  })
  .strict()
  .refine((s) => s.quantity <= itemDefinition(s.item).stackMax);
export const inventorySchema = z.array(slotSchema.nullable()).length(12);
export type Inventory = z.infer<typeof inventorySchema>;
export const receiptSchema = gatherCommandSchema
  .extend({
    result: z.enum([
      "gathered",
      "depleted",
      "range",
      "blocked",
      "tool",
      "cooldown",
      "full",
      "missing",
    ]),
    tick: z.number().int().nonnegative(),
  })
  .strict();
export const progressSchema = z
  .object({
    inventory: inventorySchema,
    receipt: receiptSchema.nullable(),
    readyTick: z.number().int().nonnegative(),
  })
  .strict();
export type Progress = z.infer<typeof progressSchema>;
export const freshProgress = (): Progress => ({
  inventory: [
    { item: "hatchet", quantity: 1 },
    { item: "starter-blade", quantity: 1 },
    ...Array<null>(10).fill(null),
  ],
  receipt: null,
  readyTick: 0,
});
