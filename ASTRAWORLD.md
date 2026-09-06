# Astraworld constitution

## The promise

Explore a shared wilderness with friends, gather materials, establish a home, fight readable monsters, and tame creatures whose abilities open new routes and resources. The defining progression is **new creature → new capability → new part of the world**.

The long-term world persists between visits. The first adventure slice is intentionally session-based; durable persistence follows immediately after its gameplay validation. See [MVP.md](MVP.md) for this distinction.

## Product pillars

1. **Cooperative discovery.** A small group shares discoveries and environmental changes. Two players prove the slice; four players are the first persistent-release capacity target.
2. **Useful companions.** Every released species needs a recognizable personality, a combat role and an environmental role. The first Moss Slime proves following and vine dissolution before content expands.
3. **A home worth returning to.** Gathering, crafting and modular building eventually turn exploration rewards into a settlement. These are later milestones, not prerequisites for the first taming loop.
4. **Readable action and charm.** A top-down 2D view, expressive silhouettes, clear attack tells and colorful natural biomes keep the browser experience legible.
5. **Trustworthy shared state.** The server decides positions, combat, ownership, inventory and world changes. Reconnecting must not create items or creatures.

## Locked constraints

- Browser-first desktop play with keyboard and mouse; top-down 2D for V1.
- Next.js, TypeScript and Vercel for the web stack; PixiJS is the preferred renderer, pending the M0 spike.
- Server-authoritative realtime multiplayer. No peer host authority and no client-written inventory.
- Redis for hot/distributed state; Postgres for durable state. Deployment lifecycle must not define world lifetime.
- Deterministic finite procedural baseline plus recorded world modifications.
- Simulation independent of React, PixiJS, browser APIs, storage and network transports.
- Code controls realtime behavior. No LLM in movement, combat, pathfinding or creature decision ticks.
- Astra owns novel systems/reference implementations; Luna expands established, documented patterns.

## First playable promise

Two players join a procedural Meadow, move together, gather wood and berries, fight hostile Slimes, discover a curious Moss Slime, feed it three Sweet Berries, gain a following companion, dissolve a vine barrier and enter a Forest clearing. Stop at the clearing. Aim for a satisfying 10–15 minute first session.

## Explicit non-goals

No MMO, 100-player rooms, 3D or voxel terrain, rotating 3D camera, terrain sculpting, infinite world, PvP, trading economy, marketplace, breeding/evolution, dozens of creatures, advanced combos, AI NPCs, quest generation, mobile optimization, elaborate customization or admin product in the slice. Do not add crafting or settlement building to that slice.

Minimal session identity and access control are required for multiplayer integrity; this does not authorize building an account-management product. The later durable release needs a stable identity binding.

## How decisions change

The user's latest explicit direction outranks this package. Otherwise preserve locked choices, validate provisional defaults within milestone scope, and record changes in [the decision log](docs/decisions/DECISIONS.md). Do not silently restore superseded Three.js, three-biome MVP or crafting-first plans from earlier discussion.
