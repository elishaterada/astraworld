# World generation and chunk streaming

## Slice defaults

Use a finite 128×128 tile world, divided into 16×16 tile chunks. Coordinates use tile units, not the earlier 3D proposal's meters. These sizes are provisional test defaults. The slice contains a Meadow and a small Forest entry region; it does not need climate simulation to prove the loop.

World identity consists of seed, generation version and content version. Same inputs produce identical terrain, blockers, node IDs and spawn slots regardless of chunk load order. Use independent seeded random streams for terrain, resources and creatures. Cosmetic variants cannot change gameplay generation.

## Generation pipeline

1. Lay out the safe spawn, Meadow activity area, gate corridor and Forest clearing as a constrained progression skeleton.
2. Fill terrain using seeded noise/variation within that layout.
3. Place blockers, then compute reachability on the collision grid.
4. Place berry/tree nodes and hostile/tameable habitats outside spawn protection and required traversal corridors.
5. Validate the progression graph: enough accessible berries, reachable tameable habitat, closed gate before utility and connected Forest path after opening.
6. Repair failed placements deterministically using bounded attempts; fall back to a known valid layout rather than loop forever.
7. Emit baseline chunks with stable object/spawn IDs; overlay saved modifications on activation.

Generate at least six accessible berry units so two players can each tame a separate Moss Slime without a resource dead end. Reserve at least two tameable spawn slots and separate hostile spawns. A player cannot kill a curious tameable in the slice. The mandatory barrier has a dissolution target reachable from the Meadow side and no ordinary walk-around route.

## Streaming and activity

Start with server activation of a 3×3 chunk neighborhood around each player, unioned across the room, plus any chunks needed by active attacks or companions. Tune radius by measured sight/attack ranges; visual camera margin must not reveal unloaded collisions. Client rendering can use a separate larger lightweight terrain margin.

Unoccupied chunks stop creature AI. Keep modified state in the session/durable layer rather than forgetting depletion. A chunk cannot unload while it has unresolved reserved interactions. Static seed data may be regenerated; mutable entities require checkpoints or durable overlays.

On leaving interest, tell the client which entities to remove. On returning, send current state rather than assuming the old visible chunk is still valid. Persist tombstones for harvested nodes and claimed creature spawns from M6.

## Resource regeneration

For the slice, depleted trees and bushes remain depleted for the session. Generation guarantees enough resources, and test-world reset is the explicit recovery for developer runs. Later respawn may use server timestamps and protected settlement zones, but it must never regrow through structures or resurrect a tamed creature's origin slot.

## Later world ambition

After the slice, introduce moisture/temperature/elevation fields as 2D biome-selection data, then ruins, caves, shrines and bosses one milestone at a time. Elevation does not imply mesh terrain. Frozen Peaks, Coast and Marsh are concepts, not required generated regions. Keep finite worlds until content density and navigation justify expansion.

## Acceptance

For 100 fixed seeds and multiple chunk load orders: compare generated hashes, validate routes and resource minimums, assert IDs are unique and stable, and apply the same edit overlay twice without duplication. A generated world that looks attractive but cannot reach the tame/gate loop fails.

## Implemented M0 subset (2026-09-06)

`packages/world/index.ts` emits a 128×128 Meadow in 16×16 chunks, identity `meadow-1` / `placeholder-1` / normalized seed. Seeds are trimmed and capped at 64 UTF-16 code units, with unmatched surrogate halves replaced by U+FFFD; blank input becomes `meadow-001`. Stable IDs include the encoded seed and tile coordinates.

A string hash plus independent coordinate-hash streams choose terrain decoration, blocker presence and blocker type. A chunk needs no state from its neighbors, so request order cannot affect output. The baseline remains fully resident for this small sandbox; render culling is implemented, activation/streaming is deferred.

Spawn is (64.5, 64.5), protected by a five-tile-radius clearing. Three-tile-wide north/south and east/west trails connect the finite map. Sparse tree/rock placeholders occupy only even-coordinate cells outside the clearing and paths, leaving connected walking lanes. The outermost tile ring and out-of-world queries are solid. Tree/rock placeholders have no resource or interaction state.

G0 checks all 100 seeds (`seed-0`…`seed-99`) in forward, reverse and permuted chunk orders, unique IDs, and flood-fill reachability of every non-solid cell. Berry supplies, creatures, Forest routes, edits and overlays are intentionally absent and their generation tests remain later work.

## 3D presentation compatibility — 2026-09-07

Generation and collision are unchanged. Three.js renders tile `(x,y)` at `(x,0,y)`; block heights and per-variant tree geometry are cosmetic. There is no voxel editing, elevation pathfinding or new terrain kind. Existing seeds, stable IDs and room namespaces remain compatible across the visual migration.

## Living Meadow baseline — 2026-09-07 (current)

The explicit environment request supersedes the migration-only compatibility paragraph above. Current identity is `meadow-2 / environment-1`; `p8-c4-env1` isolates older rooms/clients. Six seeded pond landmarks and four camp clearings add `water`/`shore` terrain and `water`/`campfire`/`log` blockers. Pond banks, camp seats and fire pits use full-tile collision shared by server and client. Clears around landmarks preserve paths and reachable dry ground. Fire and water have no interactive mechanics. [Contract and acceptance](milestones/LIVING_MEADOW.md).

## M2 resource overlay (current)

`meadow-2 / gathering-1` keeps all Living Meadow terrain/collision rules and adds a separate deterministic resource baseline in `packages/world/resources.ts`. Every baseline tree is harvestable; seeded nonblocking bushes appear on grass, plus guaranteed bushes at (65.5,63.5) and (63.5,65.5). Reserved clear curious-creature slots are (61.5,64.5) and (64.5,68.5); no creatures spawn yet. Resource IDs prefix the versioned tile ID. Depletion overlays never alter collision and survive session checkpoints; tree stumps remain solid. A full bitset in canonical resource order transmits depletion compactly on every snapshot; no missing-delta dependency.

## M5 gated Forest skeleton

`meadow-3 / utility-1 / p8-c4-m5` supersedes the wholly connected Meadow requirement. The baseline gate is closed. A fixed closed perimeter bounds the small Forest entry at x58–70, y26–38; three vine tiles at x63–65, y38 are its only passage. `packages/world/forest.ts` owns this skeleton. Seeded surroundings, chunk order and node IDs remain deterministic. The 100-seed oracle now requires all ordinary Meadow dry ground reachable while the Forest interior is inaccessible, then all dry ground connected with `World.gateOpen` applied. Both spawn berry bushes and Moss sites remain outside the gate. The optional gate overlay changes queries rather than mutating baseline tiles; resource IDs/depletion order remain stable within this new version.
