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
| D015 | Unresolved reference | Approved promo image absent from retrievable history | Obtain/inspect original before final assets |
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
