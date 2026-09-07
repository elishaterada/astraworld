# Astraworld

A top-down 2D cooperative browser adventure where befriending creatures gives players new ways to explore a persistent wilderness.

**Status: M1 complete within the recorded test envelope.** Hosted lifecycle, real TCP-loss/recovery, and ten-minute eight-player verification passed; see [M1 completion](docs/milestones/M1_COMPLETION.md). Up to eight private browser sessions can explore the same Meadow with immediate local prediction, synchronized facing/walking/waves, server-owned movement and Redis-backed recovery. The concept-inspired art, username entry and fullscreen experience remain. The existing Vercel project and Redis service now host the same multiplayer runner. No new cloud service was provisioned. See [M1 local results](docs/milestones/M1_LOCAL_RESULTS.md); M2 has not started.

## Start here

1. Read [ASTRAWORLD.md](ASTRAWORLD.md) for the product constitution.
2. Read [AGENTS.md](AGENTS.md) and [ASTRA.md](ASTRA.md) for execution boundaries.
3. Read [MVP.md](MVP.md) and [the roadmap](docs/ROADMAP.md) for the exact slice and milestone gates.
4. Read [architecture](docs/ARCHITECTURE.md), [networking](docs/NETWORKING.md), and the documents for the selected milestone.
5. Use [MODEL_USAGE.md](MODEL_USAGE.md) to allocate work. Astra establishes systems; Luna expands verified patterns.

## Launch and play

Requires Node.js 22.12+, npm and Redis (`brew install redis` on macOS). Run `npm ci`, then keep these four terminals open from `~/repos/astraworld`:

```sh
# Terminal 1: temporary local Redis, no disk persistence
npm run game:redis

# Terminal 2: first gateway / runner candidate
GATEWAY_ID=local-a npm run game:realtime

# Terminal 3: second gateway / runner candidate
GAME_PORT=3104 GATEWAY_ID=local-b npm run game:realtime

# Terminal 4: frontend
npm run dev -- --port 3002
```

Open [Astraworld locally](http://127.0.0.1:3002), choose an adventurer name and one of four distinct adventurers (Fern, Ember, Iris or Hazel), and press **Enter Meadow**. The game requests fullscreen; unavailable fullscreen falls back to the full browser viewport. **WASD / arrows** move, **pointing** sets facing, **Space** waves, **Escape** releases focus, and **Menu** pauses your input. Other players keep exploring while your menu is open. Trees, rocks and map edges are solid.

In **Menu → Invite a friend**, press **Copy invite link** and send it to your friend. They open it, choose their own name and look, then enter the same world. For a local two-player test, open the link in another browser profile or incognito window. The private link admits up to seven additional players. A ninth member is rejected. Local loopback links work on this computer only. Nearby friends show their selected character and a name marker (circle, diamond, star or square). Reloading offers **Resume Meadow** with the same identity and look. Choices are cosmetic and are not reserved; choose different looks to distinguish the group. The connection indicator reports connecting, connected or reconnecting.

Reloading the same tab keeps its temporary session credential. **Leave meadow** returns to entry and forgets it. Session recovery lasts about 30 minutes after everyone leaves, and Redis loss can lose the session. Invitations expire 30 minutes after creation. This is not permanent saving. Shared seeds cannot be changed from the client.

The offline M0 sandbox remains available at [solo mode](http://127.0.0.1:3002/?solo=1), including its seed controls, without Redis or gateways. Artwork is a provisional [concept study](docs/art-reference/early-game-concept.png).

For the optimized frontend use `npm run build`, then `npm start -- --port 3002` instead of the dev server. [Environment examples](.env.example) document the public endpoint list and server-only settings. The standalone runner reads process environment; it does not automatically load Next.js `.env` files.

## Hosted play

[Open the deployed Meadow](https://astraworld-teradas.vercel.app). The deployment retains Vercel authentication protection, so access requires your authorized Vercel session. Hosted clients use same-origin `/api/meadow-v2` endpoints automatically; they do not connect to the visitor's localhost. `REDIS_URL` remains server-only. See [hosting evidence](docs/milestones/M1_DEPLOYMENT.md).

Production and preview rooms use separate Redis namespaces. The new M1 protocol uses 60 Hz local prediction, bounded input batches, replicated facing/walking/waves and proactive socket renewal within Vercel. See [the responsiveness contract and evidence](docs/milestones/M1_RESPONSIVENESS.md). Eight-player rooms use an isolated capacity namespace; refresh and create a new Meadow/invitation after this upgrade. Earlier two-player invitations are not migrated. See [eight-player verification](docs/milestones/M1_EIGHT_PLAYERS.md). The four-character art update also isolates older clients that cannot recognize Hazel: refresh and create a new Meadow/invitation. See [character-art verification](docs/milestones/M1_CHARACTER_ART.md). The world remains a temporary session prototype.

## Verification

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
# With all four services running:
BASE_URL=http://127.0.0.1:3002 npm run test:browser
# Ten-minute eight-player soak with the normal 240-second socket renewal:
BASE_URL=http://127.0.0.1:3002 M1_EIGHT_SOAK=1 npx playwright test tests/e2e/eight-players.spec.ts
```

The rule/integration suite launches a disposable Redis process itself; Redis must be on PATH. The ordinary browser suite skips the separate ten-minute M0 and M1 soaks. Read-only `?debug=1` reports measurements without a state-mutation API. [M1 results](docs/milestones/M1_LOCAL_RESULTS.md) distinguish local evidence from outstanding deployed-host and network gates.

The next eligible milestone is **M2 gathering and inventory**, when explicitly requested. M2 has not started. See [M1 acceptance evidence and limitations](docs/milestones/M1_COMPLETION.md).

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

The implementation uses one npm package with `app/` for Next.js/React/Pixi, `packages/world/` for generation, `packages/simulation/` for pure movement, and `tests/` for rule/browser checks. `apps/game-server/` now contains the standalone M1 gateway, Redis adapter and runner; `packages/protocol/` contains strict wire schemas. The following longer-term layout remains a guide for later milestones:

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
