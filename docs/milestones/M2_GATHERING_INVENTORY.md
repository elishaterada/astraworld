# M2 Gathering and inventory

Authorized by “Works great. Move on to next” after Living Meadow, 2026-09-07. Active scope: shared trees and berry bushes, granted hatchet and inert starter blade, 12 inventory slots, stacks of 99, E to gather. No M3 combat, crafting, storage, or permanent saving.

Implementation plan: declarative validated content and pure gathering rules; deterministic resource baseline; existing fenced room checkpoints carry inventory, depletion and command receipts together; client retry and compact inventory; original 3D resource models and gather gesture. Files span packages/content, packages/simulation, protocol, gateway, network, renderer and HUD. Existing Redis and Vercel stack suffice.

## Authority and recovery decision

Each player has a monotonically increasing gather command sequence, independent of movement/socket generation. Only the next sequence executes. Latest receipt retains target and outcome; exact retries return that receipt, conflicting retries cannot change it, older sequences cannot execute again. One outstanding command per client; retransmit until a committed snapshot confirms it. The room serializes commands; reward and depletion are one immutable state transition. Existing Redis lease/generation fencing atomically checkpoints the whole state before publishing any success. A lost uncommitted action can be retried; an acknowledged action survives owner replacement while Redis state exists.

Gathering resolves on accepted interaction with a 30-server-tick (500 ms) recovery interval. Animation is immediate local feedback; confirmed inventory and depletion never predict rewards. Trees become solid mossy stumps, retaining the original collision footprint. Berry bushes are nonblocking. No respawn within a session. Alive validation is vacuous until health exists in M3; the required hatchet is checked in server inventory. No tool selection is needed; correct tool is used automatically.

New content/room namespace isolates M1 rooms. Baseline geometry remains unchanged; resource definitions have stable versioned IDs. Two guaranteed bushes next to the spawn trail provide six berries, with additional seeded bushes off the paths. Two clear positions are reserved as future curious Slime slots, without spawning creatures.

## Acceptance gates

- Deterministic reachable resources and unchanged collision paths.
- Contention awards exactly one yield; exact retry/reconnect never duplicates grants/rewards.
- Invalid target/range/line of sight/tool/cooldown/capacity rejects without depletion.
- Stack boundaries and strict inbound schemas tested.
- Actual two-context browser gather, shared depletion, tree harvest, inventory and reload recovery.
- Typecheck, unit/integration tests, production build and browser regression checks.

Results and limitations follow below. Stop before M3.

## Local completion evidence — 2026-09-07

M2 I0/I1 gates PASS within this envelope; M3 remains unstarted. Implementation is the commit containing this document, based on `8ce1516`. No new dependency or service was introduced.

- `npm run typecheck`: PASS; `npm test`: 46 tests across 15 files PASS; `npm run build`: PASS (Next 16.3.4 production build).
- Pure tests cover atomic final-node contention, original receipt on duplicate/conflicting retries, membership boundary, range, blocked interaction, tool, cooldown, full inventory, stable stack fill and content/schema failures. 100 seeds have unique deterministic resources, six guaranteed accessible berries and two clear reserved spawn slots. Existing 100-seed flood tests still cover all dry-ground reachability.
- Real Redis/two-gateway tests continuously resend both competing requests: exactly three berries total, one depleted node, one starter hatchet per identity. Checkpoint contains inventory/depletion/receipt before the snapshot. Forced owner lease turnover, new socket generation, conflicting retry and a 2.2-second Redis pause retain the result and never duplicate rewards. Queued actions retain their authenticated generation and are discarded on replacement.
- `BASE_URL=http://127.0.0.1:3002 npx playwright test tests/e2e/gathering.spec.ts tests/e2e/gameplay.spec.ts tests/e2e/characters.spec.ts`: 8 PASS. Two separately authenticated contexts race on the spawn bush, agree on depletion, chop a tree, observe the gather resource kind and reload inventory. Movement, diagonal speed, camera, collision, focus, resize, native fullscreen, repeated remount cleanup, deterministic rendering and character/invite flows passed. [Gather results](evidence/m2-browser.json), [berries](evidence/m2-berries.png), [stump](evidence/m2-stump.png), [regression](evidence/m2-v2-regression-browser.json), [cleanup](evidence/m2-v2-regression-lifecycle.json), [characters](evidence/m2-characters.json).
- Focused eight-context performance run: PASS, 61.058 seconds, Apple M4 Pro / macOS kernel 25.6.0 / Chromium 153.0.8010.12, 1280×800 per context. All eight p95 frame intervals 16.7–16.8 ms, max 33.4 ms, seven peers each, no collision failures; retained heap change -0.19 to +1.37 MiB, six geometries/three shadow textures. [Measured output](evidence/m2-performance.json). This performance mode returns before the ninth-player/rejoin scenario; capacity permission tests run in the unit/integration suite.
- Agent-browser production-server entry review: page, username, four character choices and enter/resume UI render with no reported browser errors. Gameplay screenshots were visually reviewed; the gold target ring, fruit removal, mossy stumps, satchel counts and tool gesture are readable. Final focused browser rerun follows the generation-queue guard.

The initial test run found old expected `environment-1` IDs/hash values, updated for the deliberate `gathering-1` namespace; these were fixture compatibility failures. The new baseline hash is `6ac732ada6690c9123aeac191f3b9270ccf34950bf126107d5aa830719307a1a`. Previous milestone evidence was preserved under its original filenames; current outputs use `m2-` names.

## Limits and next task

Recovery remains Redis-backed and temporary (30 minutes); Redis loss is not durable recovery. Closing a page before an acknowledgement may abandon its pending action; re-entry resynchronizes committed inventory before permitting a new action. The latest receipt is retained, while older sequences are suppressed by the high-water mark. The solo developer harness uses the same rules locally and resets on regeneration.

This run does not repeat M1's ten-minute soak or true TCP-loss experiment, and does not establish M2 action latency under WAN packet loss, Safari or Firefox support, or durable crash/Redis-loss recovery. The targeted backend pause and owner-turnover tests are explicitly narrower. Hosted M2 smoke results are recorded below. M3 combat is the next eligible milestone and requires a new request.


## Hosted completion — 2026-09-07

Implementation commit `7d0b85b` pushed to origin/main and deployed successfully through the existing Vercel Git integration. Production health reported `ready: true`, owner prefix `7d0b85b`, region `iad1`, Redis round trip 1.42 ms. No error logs were returned by a five-minute production error scan.

`BASE_URL=https://astraworld-teradas.vercel.app HOSTED_ACCESS_FILE=<private temporary file> GATHER_EVIDENCE_PREFIX=docs/milestones/evidence/m2-hosted npx playwright test tests/e2e/gathering.spec.ts`: PASS. Two separate browser contexts used existing protected-deployment automation access. One received three berries while the competitor received depletion feedback; both saw the tree harvest, the actual satchel displayed three Wood, and reload retained the inventory and depletion. Final focused run: 8.1 seconds / Chromium 153.0.8010.12. [Hosted results](evidence/m2-hosted-browser.json), [winning satchel](evidence/m2-hosted-berries.png), [harvested tree](evidence/m2-hosted-stump.png). These screenshots wait for the four-Hz HUD to display the committed count rather than only checking the renderer snapshot. Local focused rerun also passed in 6.2 seconds.

Existing deployment protection was retained. The temporary credential file was removed, and no credentials were written to evidence or Git. This hosted smoke does not expand the WAN/soak limitations above. M2 is complete within the recorded local and hosted envelope. Stop before M3.
