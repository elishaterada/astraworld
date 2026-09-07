# Astraworld

A cozy 3D cooperative browser adventure where befriending creatures gives players new ways to explore a persistent wilderness.

**Status: M3 combat implemented and verified locally and on Vercel; see [M3 results and limitations](docs/milestones/M3_COMBAT.md).** M1 is complete within its recorded test envelope. Hosted lifecycle, real TCP-loss/recovery, and ten-minute eight-player verification passed; see [M1 completion](docs/milestones/M1_COMPLETION.md). Up to eight private browser sessions can explore the same Meadow with immediate local prediction, synchronized facing/walking/waves, server-owned movement and Redis-backed recovery. The user-authorized visual migration replaces sprites with original modular Three.js models, while retaining username entry and fullscreen. See [3D migration](docs/milestones/VISUAL_3D_MIGRATION.md). The existing Vercel project and Redis service now host the same multiplayer runner. No new cloud service was provisioned. See [M1 local results](docs/milestones/M1_LOCAL_RESULTS.md).

## Start here

1. Read [ASTRAWORLD.md](ASTRAWORLD.md) for the product constitution.
2. Read [AGENTS.md](AGENTS.md) and [ASTRA.md](ASTRA.md) for execution boundaries.
3. Read [MVP.md](MVP.md) and [the roadmap](docs/ROADMAP.md) for the exact slice and milestone gates.
4. Read [architecture](docs/ARCHITECTURE.md), [networking](docs/NETWORKING.md), and the documents for the selected milestone.
5. Use [MODEL_USAGE.md](MODEL_USAGE.md) to allocate work. Astra establishes systems; Luna expands verified patterns.

## Launch and play

Development requires Node.js 24+, npm, Redis and the installed Vercel Portless CLI. Run `npm ci`, then:

```sh
npm run dev
```

This starts local Redis when needed, two game gateways and Next.js through Portless. The stable address on this machine is **https://astraworld.localhost:1355**; `portless get astraworld` prints the address for your proxy configuration. Portless selects internal ports automatically, so neither the browser URL nor the gateway URLs need to change. HTTPS and WebSocket connections use the local trusted Portless certificate. On a machine where Portless can bind port 443, the same hostname has no port suffix.

Stop the launcher with Ctrl+C. It stops the children it started; it leaves an existing Redis process and the shared Portless proxy alone. Its own Redis is temporary with no disk persistence, so stopping it discards local sessions. Standalone gateways read process environment, not Next.js `.env` files.

For fixed-port network fault tests or production-build review, the previous separate-terminal flow remains available:

```sh
npm run game:redis
GATEWAY_ID=local-a npm run game:realtime
GAME_PORT=3104 GATEWAY_ID=local-b npm run game:realtime
npm run dev:next -- --port 3002
```

Open [Astraworld locally](https://astraworld.localhost:1355), choose an adventurer name and one of four distinct adventurers (Fern, Ember, Iris or Hazel), and press **Enter Meadow**. The game requests fullscreen; unavailable fullscreen falls back to the full browser viewport. **WASD / arrows** move, **pointing** sets facing, **Space** waves, **Escape** releases focus, and **Menu** pauses your input. Other players keep exploring while your menu is open. Trees, rocks, logs, water and fire pits are solid. Wander northwest from spawn to Willow Pond or southeast to Wayfarer’s Rest.

In **Menu → Invite a friend**, press **Copy invite link** and send it to your friend. They open it, choose their own name and look, then enter the same world. For a local two-player test, open the link in another browser profile or incognito window. The private link admits up to seven additional players. A ninth member is rejected. Local loopback links work on this computer only. Nearby friends show their selected character and a name marker (circle, diamond, star or square). Reloading offers **Resume Meadow** with the same identity and look. Choices are cosmetic and are not reserved; choose different looks to distinguish the group. The connection indicator reports connecting, connected or reconnecting.

Reloading the same tab keeps its temporary session credential. **Leave meadow** returns to entry and forgets it. Session recovery lasts about 30 minutes after everyone leaves, and Redis loss can lose the session. Invitations expire 30 minutes after creation. This is not permanent saving. Shared seeds cannot be changed from the client.

The offline M0 sandbox remains available at [solo mode](https://astraworld.localhost:1355/?solo=1), including its seed controls, without Redis or gateways. Artwork is a provisional [concept study](docs/art-reference/early-game-concept.png).

For the optimized frontend use `npm run build`, then `npm start -- --port 3002` instead of the dev server. [Environment examples](.env.example) document the public endpoint list and server-only settings. The standalone runner reads process environment; it does not automatically load Next.js `.env` files.

The [Living Meadow environment](docs/milestones/LIVING_MEADOW.md) adds ponds, bonfire clearings, mist, firelight and richer vegetation. It uses a new landscape version: **refresh, create a fresh Meadow and send new invite links** after this update. Earlier temporary-room invitations are not migrated.

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

The next eligible milestone is **M4 taming and following**, after M3 is accepted and explicitly requested. See [M3 evidence and limitations](docs/milestones/M3_COMBAT.md).

## Document map

| Document | Purpose |
| --- | --- |
| [Product vision](docs/PRODUCT.md) | Audience, pillars, success measures, non-goals |
| [Game design](docs/GAME_DESIGN.md) | Player loop, controls, progression and cooperative rules |
| [Art direction](docs/ART_DIRECTION.md) | Supplied visual reference, implemented assets and provisional targets |
| [Rendering](docs/RENDERING.md) | Three.js/React boundary, camera, layers and performance |
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

The implementation uses one npm package with `app/` for Next.js/React/Three.js, `packages/world/` for generation, `packages/simulation/` for pure movement, and `tests/` for rule/browser checks. `apps/game-server/` now contains the standalone M1 gateway, Redis adapter and runner; `packages/protocol/` contains strict wire schemas. The following longer-term layout remains a guide for later milestones:

```text
apps/web/             Next.js UI and client-only Three.js renderer
apps/game-server/     Realtime gateway, room runner and persistence adapters
packages/simulation/ Pure TypeScript authoritative rules
packages/protocol/    Validated messages and version negotiation
packages/world/       Seeded generation and collision queries
packages/content/     Definition schemas and content validation
content/              Biome, creature, item, ability and recipe data
tests/                Cross-package integration and browser scenarios
```

Do not create a package per mechanic until ownership or dependency boundaries justify it. The layout is a guide, not a requirement to scaffold empty packages.


## Gathering in the Meadow (M2)

Walk near a pink berry bush or a tree. The gold ground ring marks your nearest available resource. Press **E** to gather: a bush gives three Sweet Berries and a tree gives three Wood. Trees leave solid stumps, bushes lose their berries, and every player sees the same change. Your 12-slot satchel includes a starter hatchet and a usable starter blade. Items stack to 99; full inventories reject the whole harvest.

Only confirmed server results change the satchel. Resume the same browser session to recover items and depleted resources within the existing 30-minute recovery window. Leaving starts a new adventurer; Redis loss still loses progress. This is not permanent saving. Old M1 invitations/sessions are isolated from M2; create a new Meadow and share its new invite.

M2 uses the existing local launch commands above and the existing Vercel/Redis stack. No new services or credentials are required. M3 adds combat; taming, crafting and building remain later milestones.

The compact game HUD keeps your satchel closed until you press **I** or click its bottom-right button. **I** or **Escape** closes it; Escape during play opens the pause menu. Movement guidance appears once per browser and can always be found under **Menu → Controls**. Nearby gathering prompts and brief pickup notifications remain visible without opening inventory.


## Combat on the north trail (M3)

Refresh and create a **new Meadow**; M3 uses new room/session IDs, so send a fresh invitation. Use ordinary entry (the offline solo harness retains M0/M2 behavior). Walk north along the central trail to find the Wild Slime, beyond Willow Pond. **Click or J** swings the starter blade toward your facing direction; point to aim. **Shift + direction** dodges; Shift alone dodges in your facing direction. A short first-play hint introduces these controls; Menu → Controls keeps them available.

The Slime has 30 health and takes three blade hits. Step or dodge outside its amber circle before the slam, then counterattack during recovery. Your compact lower-left health bar shows server-confirmed health. At zero health you recover at safe spawn after two seconds with your items retained. Players cannot hurt one another. Defeated Slimes remain defeated for the temporary room; create a new Meadow for another encounter. There are no drops, healing items, taming or new weapons in M3.

Combat and inventory recover together through the existing temporary Redis checkpoint. This is not permanent saving or lag compensation. See [the complete M3 contract, checks and limitations](docs/milestones/M3_COMBAT.md). M3 is deployed through the existing Vercel project; refresh and create a new Meadow for its isolated room version.
