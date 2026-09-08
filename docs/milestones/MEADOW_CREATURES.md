# Meadow creature population

User-authorized after M7: “Add more monsters and more pets in the world.” This expands existing Meadow encounters, not M8 settlement or M9 bosses.

## Implementation

- Six hostile Slimes total: the original north-trail encounter plus five encounters across the west, east and southern Meadow. Eight tameable Moss Slimes total, enough for one companion per player. Existing berry costs, exclusive ownership, follow/stay/recall and gate utility are unchanged. No new species, loot rewards, automatic respawning or combat abilities.
- Habitat targets live in `packages/content/creatures.ts`. A bounded deterministic flood fill chooses clear homes reachable from camp without entering the gated Forest. Terrain, saved positions, generation IDs and namespace remain unchanged. First monster and first two pet IDs are preserved. Loading an older aggregate appends only missing IDs; owned pets, claims, receipts and defeated encounters survive.
- Combat resolves every player strike before enemy impacts. One swing can hit each eligible hostile once (maximum six IDs); death/respawn cannot duplicate across simultaneous slams. Workbench placement checks all living creatures. Defeat transitions trigger durable publication; Postgres rejects resurrection or removal of a defeated encounter.
- Snapshots retain the legacy `slime` and add at most five `monsters`; `moss` is bounded to eight. Wire protocol **4** rejects incompatible old clients. Deploy all gateways and the client together, then refresh tabs; do not overlap old and new runners against live saved rooms. No SQL table migration is required for the additive JSONB fields.
- Three.js has a fixed pool of six hostile views and at most eight pet models. Each hostile has its own health label and slam tell. Seeded coat colors distinguish pets and hostile instances. Art remains original block-built placeholders, and colors do not change abilities.

## Verification

- Full local Vitest suite: **86 passed, zero failed or skipped**, using real PostgreSQL. Includes twenty-seed home reachability, eight distinct pet owners with exact food consumption, six-target attacks, simultaneous lethal slams, idempotent old-save expansion and Postgres defeat/ownership recovery. [Report](evidence/population-tests.json).
- TypeScript and optimized Next.js build passed.
- Two independent browser contexts verified eight pet identities, six hostile instances, a new pet reached through normal movement, a new hostile encounter visible to the other player, and identity continuity after reload/resume. No page errors; encounter capture reported 132 draw calls, 358,334 triangles, 16 geometries and four textures. [Browser report](evidence/population-browser.json), [pets](evidence/population-pet.png), [encounter](evidence/population-encounter.png). The initial reload test timed out because it omitted the existing Resume Meadow button; the corrected test passed in 13.9 seconds.
- Existing two-player gathering → combat → taming → interrupted gate utility → shared Forest journey passed with the expanded population. [Journey report](evidence/population-slice-browser.json). An agent-browser session also entered the game and displayed the camp without errors.

## Limits

No hosted deployment, new soak, eight-window performance acceptance or Safari/Firefox matrix was run. Existing M6 backup/provider and human acceptance gates remain open. Encounters retain the existing permanent defeat rule; expansion does not revive cleared monsters. New species and behaviors remain separate design work. Next roadmap milestone remains M8 and is not implemented here.
