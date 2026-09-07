# M1 mission: authoritative multiplayer (up to eight players)

**Status: M1 complete within the recorded test envelope. See [completion and acceptance matrix](M1_COMPLETION.md). M2 is eligible only upon a new explicit request and has not started.**

The user explicitly expanded the room limit from two to eight after the two-player reference. See [capacity decisions and checks](M1_EIGHT_PLAYERS.md).

## Mission

Up to eight independent browser sessions explore the same Meadow with server-owned movement, smooth local response and consistent reconnect behavior. Prove actual hosting lifecycle constraints before building gameplay systems on them.

## Required reading

[AGENTS.md](../../AGENTS.md), [ASTRA.md](../../ASTRA.md), [architecture](../ARCHITECTURE.md), [networking](../NETWORKING.md), [entity system](../ENTITY_SYSTEM.md), [persistence](../PERSISTENCE.md), [testing](../TESTING.md).

## Work order

1. Astra High resolves a concrete room-owner/lease/checkpoint plan, transport schema, session credentials and lifecycle test. Check the current host's actual APIs, limits and availability.
2. Astra Medium moves authoritative simulation into the runner, adds bounded WebSocket intents/snapshots and minimal server-issued session/world access.
3. Add local prediction/reconciliation, remote interpolation, input timeout and full resync.
4. Introduce Redis-backed routing, presence, fenced ownership and hot checkpoint recovery. Keep credentials server-side and environments separate.
5. Test independent gateway connections to one world, owner failure/expiry, stale-owner rejection and reconnect to another instance. Force lifecycle rotation rather than waiting for an incidental timeout.
6. Verify the chosen deployed runtime. If the Vercel runner experiment cannot pass, record evidence and the alternative long-lived runner decision while retaining the Vercel frontend and pure simulation.

## Exit criteria

N0–N4 in TESTING.md pass with actual network traffic; clean and degraded-network browser scenarios are recorded; session recovery works within the declared window; one world has only one effective authority; the deployed-host lifecycle spike has evidence. A local-only demo is partial completion until the hosting gate is verified.

## Stop line

No resource rewards, inventory, attacks, taming, crafting, Postgres gameplay persistence, matchmaking or scaling beyond eight players. Minimal identity protects session authority; do not build account settings/admin UI. If service access blocks deployed verification, finish local tests and identify the exact missing prerequisite without advancing to M2.
