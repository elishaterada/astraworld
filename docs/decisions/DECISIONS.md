# Decision register

Planning baseline: 2026-09-06. “Locked” reflects explicit user direction or the latest adopted conversation direction. “Provisional” is a proposed default to validate. “Deferred” means do not implement yet.

| ID | Status | Decision / rationale | Validation or revisit point |
| --- | --- | --- | --- |
| D001 | Locked | Astraworld name; companion-enabled cooperative exploration | User direction |
| D002 | Locked | Top-down 2D browser game for V1 | Supersedes original 3D/isometric proposal |
| D003 | Provisional preferred | PixiJS rendering with Next.js UI | M0 rendering/input/performance spike |
| D004 | Locked | Next.js/Vercel web stack; server-authoritative realtime | Latest handoff |
| D005 | Locked | Redis hot/distributed state and Postgres durable state | M1 hot-state proof; M6 durability proof |
| D006 | Provisional | Vercel Fluid Compute gateway/room runner | M1 lifecycle and cross-instance tests; external runner fallback if needed |
| D007 | Locked scope | Adventure slice stops at Forest entry; crafting/building later | Latest 2D MVP supersedes earlier broad MVP |
| D008 | Provisional sequencing | M5 session prototype, M6 durable release | Explicitly distinguish temporary recovery from persistence |
| D009 | Provisional | 128×128 tiles; 16×16 chunks; 20 Hz tick; 10 Hz snapshots | M0/M1 measured evidence |
| D010 | Provisional | Two-player slice; four-player first persistent target | M1 then M6 load test |
| D011 | Provisional | Three direct Sweet Berry feeds; exclusive expiring claim | M4 usability/contention tests |
| D012 | Provisional | Curious Slimes non-targetable; retain items on player death | M3/M4 recovery and progression testing |
| D013 | Locked process | Astra establishes systems; Luna expands patterns | MODEL_USAGE.md |
| D014 | Unresolved naming | Requested “Luna 4.6” differs from documented GPT-5.6 Luna | Resolve before actual Luna dispatch; no silent substitution |
| D015 | Current reference supplied | User attached early-game-concept.png on 2026-09-06 and requested matching its style | Archived and inspected; generated assets remain an art study |
| D016 | Provisional | Pixel-art test, 32-pixel terrain tiles, fixed camera | Compare to original promo; M0 visual test |
| D017 | Deferred selection | Stable auth provider, Postgres provider/ORM and Redis deployment | Choose before M6/M1 respectively when needed |
| D018 | Deferred | Marsh, bosses beyond M9, breeding, evolution, AI NPCs, economy | New milestone decision required |

## Superseded proposals

Three.js, React Three Fiber, Drei, Rapier, mesh terrain, 35–45 degree 3D camera and camera rotation were part of the initial direction and are not the implementation plan. A three-biome MVP, early crafting axe loop and early settlement construction were narrowed by the later 2D adventure-slice decision. The original suggested milestone numbering is replaced by [ROADMAP.md](../ROADMAP.md).

Creature ideas such as berry jelly, low-health capture, Acid Spit, swamp utility and evolution were examples, not a requirement to combine all of them into the first Slime. This package chooses three direct berry feeds and vine dissolution as the bounded reference.

## Updating a decision

Add date, status, observed problem, considered alternatives, selected choice, consequences and affected documents. Update the canonical contract instead of leaving contradictory instructions elsewhere. Provisional tuning within scope does not require a new approval ritual; changes to locked product direction require explicit user direction.

## M0 implementation decisions — 2026-09-06

- **D003 validated locally:** use PixiJS 8.20.1 with client-only asynchronous initialization and a private ticker. Chosen over another renderer to test the proposed stack directly. Production art approval and wider browser coverage remain separate.
- **D009 retained for M0:** 128×128 tiles, 16×16 chunks, 20 Hz simulation. Four tiles/second and a 0.48-tile square player body are provisional reference values. Interpolate for display instead of raising the simulation frequency; no snapshot/network rate is implemented.
- **D019 adopted M0 boundary:** a browser-local harness runs pure simulation temporarily. No server authority claim, service scaffolding or provisioning. M1 must replace the harness authority with its server-owned contract.
- **D020 adopted generation reference:** coordinate-hash streams and a connected lane layout provide request-order independence and bounded generation. Full-map residency plus view culling is simpler than premature streaming at this finite size. Revisit layout density and streaming with M1/M2 evidence.
- **D021 adopted collision reference:** full-tile blockers with axis-swept AABB movement; collision-aware display interpolation avoids visual corner clipping. More elaborate circular physics would add complexity without an M0 gameplay need.
- **D022 tooling:** Next.js 16.3.4, React/React DOM 19.2.8, PixiJS 8.20.1, TypeScript 5.9.3, Vitest 5.0.0, Playwright 1.63.0 agent-browser 0.36.0 and Prettier 3.6.2 pinned in package/lock files. TypeScript 5.9 was selected as a compatible stable toolchain rather than changing compiler major alongside the engine spike. Versions checked against npm; initialization/installation APIs checked against [Pixi documentation](https://pixijs.com/8.x/guides/components/application) and [Next.js documentation](https://nextjs.org/docs/app/getting-started/installation).

Affected contracts: [architecture](../ARCHITECTURE.md), [world generation](../WORLD_GENERATION.md), [rendering](../RENDERING.md), [art](../ART_DIRECTION.md), [testing](../TESTING.md). The seed layout and collision dimensions are provisional defaults, not changes to locked product direction.


## M0 style and launch refinement — 2026-09-06

- **D016 refined by explicit user reference:** detailed pixel-painted scenery and sprites replace the original geometric art. Keep 32-pixel world tiles and top-down gameplay. Sprite assets, palette, canopies, animation and cosmetic terrain now follow the supplied concept; extra biomes and mechanics shown in that image remain deferred. Astraworld's name remains unchanged.
- **D023 adopted by user request:** choose a local adventurer name before creating the game canvas, then launch edge-to-edge and request native browser fullscreen directly from the submit gesture. Retain a viewport fallback so embedded browsers or denied requests do not block play. Include an explicit fullscreen toggle, pause/resume and Leave control. Display name is local-only, resets on reload, and is not authentication.
- **D024 atlas lifetime:** cache one generated RGBA atlas with sixteen frame views for a page lifetime. Own and destroy each canvas's 64 procedural ground textures separately. Generated assets and source-frame metadata are stored as project files; the original checkerboard draft is rejected, not consumed.

[Reference and asset provenance](../ART_DIRECTION.md), [updated renderer contract](../RENDERING.md), [acceptance evidence](../milestones/M0_STYLE_UPDATE.md).

## 2026-09-06 — M1 local authority reference

User authorized the next milestone after the completed M0 refinement. Implement M1 only. Keep root Next app and pure rules, add a standalone Node HTTP/ws gateway/runner and Redis adapter. No cloud provisioning or M2 mechanics.

Provisional reference choices: two private members, opaque server-issued Redis-backed bearer credentials in tab session storage, random one-friend invitations, full snapshots instead of deltas, 48-tile nearby projection, checkpoint every 50 ms step, exactly fenced publication, 10-second lease with 3-second renewal, and generation replacement for reconnects. Player-player collision remains off; terrain collision stays authoritative. Retain `?solo=1` for M0 regression verification.

These choices prioritize a bounded authority/recovery reference. Opaque credentials are not account authentication or durable identity; host-specific short-lived credentials and refresh remain open. The actual Vercel lifecycle spike has not run, so neither the deployed M1 gate nor a hosting fallback decision is claimed. See [contract](../milestones/M1_IMPLEMENTATION.md) and [results](../milestones/M1_LOCAL_RESULTS.md).

## 2026-09-06 — D025: Vercel-only responsive M1 protocol

Explicit user decision: retain the Vercel stack; no separate always-on host or new service. Implement shared 60 Hz client prediction and server movement, precise frame acknowledgements, bounded 20 Hz input batching, facing/motion/action replication and a cosmetic wave. Keep Redis-fenced authority, short recovery leases and proactively renew finite Vercel sockets. Do not accept client positions or outcomes as facts. Use an isolated protocol-2 room namespace during rolling deployment; retain v1 for old clients. WebRTC/P2P is not introduced; gRPC is not a browser P2P transport. See [contract and acceptance limits](../milestones/M1_RESPONSIVENESS.md).

## 2026-09-06 — D026: eight-player Meadow rooms

Explicit user direction supersedes the two-member limit and four-player later capacity proposal. M1 supports up to eight distinct session members. Admission remains an atomic Redis check across gateways; disconnects retain membership for credential-based resume. Assign stable spawn slots with admission and separate spawns along the clear starting path. A shared capacity constant governs active snapshot validation, admission and counters. Preserve protocol-1's two-member compatibility path. Isolate eight-player sessions in the `p8` namespace because already-open older protocol-2 clients reject larger snapshots. Fresh entry and invitation are required; no durable saves exist to migrate. No additional mechanics or service provisioning. See [evidence and limitations](../milestones/M1_EIGHT_PLAYERS.md).

## 2026-09-07 — D027: user-authorized 3D visual migration before M2

**Accepted; supersedes D001/D003/D016's 2D/PixiJS presentation restrictions.** The user identified generated directional sprites as an unsustainable asset workflow and explicitly approved a visual migration inspired by Minecraft Dungeons. Continuing generated sheets and introducing full 3D physics were considered; choose original modular Three.js geometry over the existing flat simulation. Use a fixed elevated, screen-aligned orthographic camera, instanced Meadow cubes, four cosmetic models and shared walk/wave pivots. Preserve M1 authority, protocol, world IDs, collision, eight members and Vercel/Redis topology. No room namespace migration is necessary because inputs and schemas remain compatible. No M2 mechanics are authorized by this change.

The visual reference does not supply executable instructions, copied assets, gameplay systems or a product rename. Consequences: GPU performance must be measured anew, object occlusion uses depth plus a foliage cutout, directional accessories no longer mirror, and asset consistency comes from a shared model kit. No elevation gameplay or editable voxel terrain. See [rendering contract](../RENDERING.md), [art direction](../ART_DIRECTION.md), and [verification](../milestones/VISUAL_3D_MIGRATION.md).
