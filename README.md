# Astraworld

A top-down 2D cooperative browser adventure where befriending creatures gives players new ways to explore a persistent wilderness.

**Status: M0 implemented locally, 2026-09-06.** The playable engine sandbox has reference-inspired pixel-painted artwork, a username entry screen, fullscreen play, seeded Meadow terrain, keyboard movement, collision and a following camera. M1–M9 remain unstarted. No services or deployment have been created. See [M0 evidence](docs/milestones/M0_COMPLETION.md) for acceptance results and limitations.

## Start here

1. Read [ASTRAWORLD.md](ASTRAWORLD.md) for the product constitution.
2. Read [AGENTS.md](AGENTS.md) and [ASTRA.md](ASTRA.md) for execution boundaries.
3. Read [MVP.md](MVP.md) and [the roadmap](docs/ROADMAP.md) for the exact slice and milestone gates.
4. Read [architecture](docs/ARCHITECTURE.md), [networking](docs/NETWORKING.md), and the documents for the selected milestone.
5. Use [MODEL_USAGE.md](MODEL_USAGE.md) to allocate work. Astra establishes systems; Luna expands verified patterns.

## Launch and play

Requires Node.js 22.12+ (verified with 24.13.0) and npm.

```sh
cd ~/repos/astraworld
npm ci
npm run dev
```

Open [the local sandbox](http://127.0.0.1:3000), choose a 2–20 character adventurer name, and click **Enter Meadow**. The game fills the viewport and requests native browser fullscreen from that click; unsupported or denied fullscreen falls back to viewport play. Use **WASD / arrow keys** to walk. **Escape** pauses and releases keyboard focus. Leaving the canvas or switching tabs clears movement. Trees, rocks and the boundary are solid. The camera stays on your character.

Open **Menu** to edit the seed and press **↻** to regenerate/restart; the same seed reproduces the same map. **Leave meadow** returns to the username screen and destroys the canvas. **⛶** toggles browser fullscreen. Art is a provisional study matched to the [supplied concept](docs/art-reference/early-game-concept.png). The name is a local display label, not an account. Reloading resets everything; there is no saving or multiplayer.

The current preview uses port **3002** because another local project occupied port 3000: [open the current preview](http://127.0.0.1:3002). Run `npm run dev -- --port 3002` to use that port yourself.

See the [style and fullscreen update evidence](docs/milestones/M0_STYLE_UPDATE.md).

For an optimized local build: `npm run build`, then `npm start` (stop the dev server first, or use `npm start -- --port 3001`). No environment variables or credentials are required.

## Verification

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
# Keep the local server running in another terminal:
npm run test:browser
npm run test:soak
```

The ordinary browser suite skips the separately invoked ten-minute soak. Set `BASE_URL=http://127.0.0.1:3001` to test a production server on another port. Browser checks write evidence under `docs/milestones/evidence/`. An optional `?debug=1` exposes read-only sandbox measurements to tests; it has no state mutation API.

The next eligible milestone is **M1**, only upon a separate request. Its hosting and authority questions remain open; M0 does not prove multiplayer integrity.

## Document map

| Document | Purpose |
| --- | --- |
| [Product vision](docs/PRODUCT.md) | Audience, pillars, success measures, non-goals |
| [Game design](docs/GAME_DESIGN.md) | Player loop, controls, progression and cooperative rules |
| [Art direction](docs/ART_DIRECTION.md) | Supplied visual reference, implemented assets and provisional targets |
| [Rendering](docs/RENDERING.md) | PixiJS/React boundary, camera, layers and performance |
| [Architecture](docs/ARCHITECTURE.md) | Proposed modules, deployment boundaries and authority |
| [Entity system](docs/ENTITY_SYSTEM.md) | IDs, simulation lifecycle and component contracts |
| [Networking](docs/NETWORKING.md) | Input protocol, reconciliation, room ownership and recovery |
| [World generation](docs/WORLD_GENERATION.md) | Seeds, chunks, streaming and solvable routes |
| [Biomes](docs/BIOMES.md) | Meadow/Forest slice and later biome boundaries |
| [Gathering](docs/GATHERING.md) | Resource interactions, inventory and contention |
| [Crafting and building](docs/CRAFTING_BUILDING.md) | Post-slice recipes, placement and settlement progression |
| [Combat](docs/COMBAT.md) | Server-resolved attacks, damage and readable enemies |
| [Creature system](docs/CREATURE_SYSTEM.md) | Taming, companion control and utility abilities |
| [Persistence](docs/PERSISTENCE.md) | Hot/durable state, transactions and recovery |
| [Data model](docs/DATA_MODEL.md) | Proposed records, keys and invariants |
| [Content format](docs/CONTENT_FORMAT.md) | Declarative content, validation and expansion contracts |
| [Testing](docs/TESTING.md) | Acceptance matrix, network faults and performance budgets |
| [Roadmap](docs/ROADMAP.md) | M0–M9 ownership, deliverables and stop lines |
| [Decisions](docs/decisions/DECISIONS.md) | Locked choices, provisional choices and open questions |
| [Sources](docs/SOURCES.md) | Conversation provenance and verified platform references |

## Repository layout

M0 uses one npm package with `app/` for Next.js/React/Pixi, `packages/world/` for generation, `packages/simulation/` for pure movement, and `tests/` for rule/browser checks. No empty service packages are scaffolded. The following longer-term layout remains a guide for later milestones:

```text
apps/web/             Next.js UI and client-only PixiJS renderer
apps/game-server/     Realtime gateway, room runner and persistence adapters
packages/simulation/ Pure TypeScript authoritative rules
packages/protocol/    Validated messages and version negotiation
packages/world/       Seeded generation and collision queries
packages/content/     Definition schemas and content validation
content/              Biome, creature, item, ability and recipe data
tests/                Cross-package integration and browser scenarios
```

Do not create a package per mechanic until ownership or dependency boundaries justify it. The layout is a guide, not a requirement to scaffold empty packages.
