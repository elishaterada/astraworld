# M0 mission: engine sandbox

**Status: complete locally — G0/R0/R1 and ten-minute performance PASS.** See [completion evidence](M0_COMPLETION.md) for the gate results and limitations. Stop before M1.

## Mission

Build the smallest playable top-down 2D Astraworld sandbox: procedural Meadow, player movement, camera following and collision in a Next.js browser page using PixiJS. Establish conventions for the later authoritative simulation without adding multiplayer now.

## Required reading

[AGENTS.md](../../AGENTS.md), [ASTRA.md](../../ASTRA.md), [constitution](../../ASTRAWORLD.md), [architecture](../ARCHITECTURE.md), [rendering](../RENDERING.md), [world generation](../WORLD_GENERATION.md), [art direction](../ART_DIRECTION.md), [testing](../TESTING.md).

## Work order

1. Inspect repo and choose/pin compatible versions and minimal build tooling. Record the dependency choices.
2. Implement deterministic bounded terrain and stable tree/rock-like blocker placeholders; generation logic is independent of the renderer.
3. Implement fixed-step movement and collisions in pure TypeScript. Local simulation is the sandbox harness, not the final multiplayer authority.
4. Mount the PixiJS canvas client-side, draw terrain/actor, follow camera and handle resize/focus/cleanup.
5. Verify deterministic generation, diagonal speed, collision and render lifecycle. Measure browser frame times and save actual evidence.

## Exit criteria

G0/R0/R1 in TESTING.md pass; the player traverses the Meadow smoothly; same seed reproduces terrain/IDs; collision cannot be bypassed by diagonal movement; React/canvas boundaries and cleanup are documented. Use placeholders while the original promo is unavailable and label their provisional status.

Verify local browser behavior. If a preview deployment is included in the user's implementation authorization and available, also verify its URL; otherwise record deployment as pending rather than blocking local sandbox completion or creating cloud resources without scope.

## Stop line

No sockets, Redis, Postgres, authentication integration, inventory, harvesting, crafting, combat, taming, building or other biomes. Do not scaffold their packages just to match the proposed layout. Report M0 evidence and stop; M1 is a separate mission.
