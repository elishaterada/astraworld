# Gathering-to-settlement expansion

## Delivery boundary

Crafting begins at M7 after durable saving. Building begins at M8. Neither is needed to finish the M0–M5 adventure slice. These specifications make later work actionable without expanding the current target.

## M7: first crafting loop

Prove gather → recipe → useful tool through one stone node, stone item, Stone Axe and Workbench. Implemented M7 balance: Stone Axe costs 3 wood + 2 stone and is hand-crafted; Workbench costs 6 wood and is placed through one restricted station-placement rule. The starter hatchet can harvest wood and loose stone can be collected by hand, avoiding a crafting cycle. A later recipe may require proximity to the workbench only after its placement works.

Recipes declare ID, inputs, output, quantity and optional station requirement. No timed queue, skill XP, random outcomes or quality tiers. Server validates known recipe, inputs, station/range and output capacity, then commits input removal and output creation together. Full output capacity rejects without consuming materials.

The workbench is M7's only placeable object, establishing one placement reference for M8. It cannot be placed on the spawn, gate approach, occupied cells or non-walkable terrain. Do not expand it into a complete settlement UI in M7.

## M8: modular building

Start with floor, wall, door and chest plus the existing workbench. A simple roof/fade presentation can follow after walking through a room works; stairs, multiple floors, structural physics and terrain edits are excluded. Buildings use 2D tile footprints and bounded rotations (initially 90-degree steps).

Placement preview is client-side feedback only. Server checks member permissions, footprint, support rules if any, collision, reserved routes, range and cost. Lock occupied cells and inventory in one transaction. Two overlapping placements cannot both succeed. A path reservation around spawn and the mandatory gate prevents cooperative griefing and progression dead ends.

Initial permission policy: all members may use doors and a shared workbench; only owner or world host may dismantle a piece; chest access is shared among members. These are provisional cooperative defaults. Dismantling refunds a documented fixed material amount only once, and rejects nonempty chests until contents are removed. Do not design a generalized land-claim system yet.

Container transfers must decrement one side and increment the other atomically, validate range/access and preserve total quantity under concurrent use. Never let the browser submit complete replacement inventories.

## Longer-term settlement roles

Farms, furnaces, monster pens, kitchens and warehouses can give companions work to do. Salamander heating, Golem mining and Sprout growth are future systems that Astra must establish before content expansion. Offline production, automation chains, town NPCs and markets are non-goals for M8.

## Acceptance

M7: one recipe succeeds, insufficient ingredients/full output fails without loss, duplicate craft is idempotent, and crafted equipment survives restart. M8: build a small accessible room with storage, reopen it after restart, reject conflicting placement and protected-route blockage, and prove concurrent chest transfers conserve items.

## M7 reference decisions (2026-09-07)

[Implementation and evidence](milestones/M7_FIRST_CRAFTING.md). The Stone Axe is automatically selected for tree gathering and raises yield to five wood, preserving the starter hatchet for existing characters. Two fixed camp plots establish bounded station placement without arbitrary terrain edits. The single hand-crafted axe recipe requires no station; Workbench placement is the settlement reference, with no station-specific recipe yet. Placement is permanent until a later authorized dismantling feature. Inventories and occupied plots commit together in the M6 JSONB aggregate.
