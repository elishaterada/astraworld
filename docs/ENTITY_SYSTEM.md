# Entity and simulation system

## Core records

Definitions describe immutable content: species, base stats, allowed abilities, resource yields. Instances hold mutable state: position, health, inventory, ownership, cooldowns and depletion. References use stable IDs, not renderer objects or array positions.

Proposed entities: player, wild creature, companion (the same creature instance with ownership), resource node, utility barrier and later structure. Do not create a second creature when taming; transition the existing instance atomically.

Minimum entity fields: `id`, `worldId`, `kind`, `definitionId`, `position{x,y}`, `facing`, `revision`, and applicable components such as `health`, `collision`, `inventory`, `brain`, `ownership` or `cooldowns`. Absence of a component must be handled explicitly. A small typed composition is sufficient; a generic ECS framework is not required.

## Identity and determinism

Generated IDs derive from world ID, generation version, chunk coordinates and local stable spawn ID. Player-created structures and durable creatures use server-issued unique IDs. Taming preserves the generated creature ID and suppresses its original spawn slot; chunk reload cannot recreate it as wild.

Use a seeded random stream per chunk and subsystem so adding a cosmetic draw does not move resource spawns. Stable iteration order, fixed dt and explicit inputs make simulation tests repeatable. Cross-runtime floating-point identity is not required for authoritative clients; generation outputs must match for a pinned version.

## Lifecycle

Baseline generation → instance activation for active chunks → updates → dormancy or removal. A durable tombstone suppresses removed/depleted baseline objects when the chunk reloads. Companions are loaded with their owner's presence or stable record, not recreated through the wild spawn table.

Each tick receives `dt`, tick index, validated commands, world queries, definition lookups and seeded random access. It returns updated state plus domain events; adapters perform I/O. Avoid hidden timers and callbacks inside entity logic.

## Spatial rules

Use tile-based static blockers and simple actor circles/AABBs. Share collision queries between server movement and local prediction. Build a spatial index only when needed for nearby targeting; no 3D physics stack. Define collision masks for actor versus terrain, attack versus targets and structure footprints separately.

## First reference acceptance

M0: one actor collides identically for a fixed input sequence. M2: a node depletes once. M3: an attack hits once per eligible target. M4: a wild entity becomes one owned companion without duplicate spawn. M5: barrier state and collision change together. Later content cannot override these invariants through data fields.
