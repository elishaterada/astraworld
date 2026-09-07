# M5 companion utility and adventure slice — 2026-09-07

Authorized by “proceed” after M4 completion. Implement M5 only; stop before M6. Preserve the uncommitted M4 implementation and evidence. No deployment or permanent saving is authorized by this implementation request.

## Plan and acceptance

One designated three-tile vine barrier blocks a small Forest clearing on the north trail. Its owner presses Q with a following Moss companion nearby; a visible one-second channel opens collision for every member at the same authoritative transition. Validate permissions, target tag, living actor, companion mode, range, line, cooldown and connection generation at start and completion. Interruptions leave the barrier closed. Duplicate intents cannot reopen it or duplicate effects. Gate state survives temporary checkpoint recovery and late joins. Ordinary vegetation is not a utility target.

Files: `packages/world/forest.ts`, validated utility definition/protocol, pure `packages/simulation/utility.ts`, existing taming checkpoint/companion command transport, Three.js Forest view and compact HUD/menu guidance. No new dependency or service. Rules, 100-seed closed/open reachability, real Redis recovery, and independent two-context browser walkthrough are required. Human first-time feedback on comprehension and the intended 10–15 minute loop remains a separate acceptance gate; automated traversal does not establish fun or session length.

## Decisions

- New `meadow-3 / utility-1 / p8-c4-m5` identity isolates the changed progression geometry. Create fresh rooms/invitations. A closed stone/woodland perimeter at x58–70, y26–38 surrounds the Forest clearing. Only x63–65, y38 dissolves; there is no walk-around. Existing Meadow landmarks and spawn resources remain.
- `World.gateOpen` is a derived collision overlay. Every authoritative tick derives it from checkpointed gate state; each client applies the full gate projection before replaying pending movement. Opening and collision share one checkpoint/projection; no optimistic client gate change.
- `dissolve` uses the existing single-flight companion sequence and private receipt. Acknowledgment of channel start is not success; the gate channel and receipt result show completion/cancellation. Owner/companion/connection generation are retained in the channel. Cooldown is two seconds from start, even after cancellation. Companion range is two tiles from the south-side target; actor range is three tiles.
- Observed socket close publishes a generation-checked disconnect notification to the room owner, cancelling an active channel. An unobserved network partition uses existing three-second presence expiry: a shorter partition can finish a channel while the server still considers the actor connected. This is an explicit detection limit, not instant offline knowledge.
- Forest entry is a small cooler-green, canopy-framed destination with a completion cue. Combat remains an optional encounter rather than a hidden gate prerequisite. Menu → Your first adventure explains all slice beats. No timer artificially stretches the loop to ten minutes.

## Verification

`npm run typecheck`, `npm test` and `npm run build` all PASS on the final implementation: 67 tests across 21 files, 16.37 seconds; Node 24.13.0, Next 16.3.4, Redis 8.10.1. The two-context browser walkthrough passed in 1.3 minutes, including 150 ms added application RTT, optional combat/dodge/respawn, berries/wood, taming, observed-disconnect interruption, shared Forest traversal and reconnect. This is scripted traversal time, not evidence of the intended first-time human session length.

The initial eight-browser performance sample failed the ≤20 ms p95 target (33.4–49.9 ms); it overlapped HMR and integration work. The isolated repeat also failed (33.4–50 ms). [Initial sample](evidence/m5-performance-initial.json), [unbatched repeat](evidence/m5-performance-unbatched.json). These failures led to instancing the new Forest/Moss geometry and each existing character's rigid body, limbs and tools. A subsequent run caught a test timing race before the performance phase: connection readiness preceded the first rendered spawn position. The harness now waits for the rendered/authoritative position match. The eight-browser sample after batching alone still failed at p95 50.0–50.1 ms. Reducing the directional shadow map from 2048² to 1024² improved the final eight-browser result to p95 33.4–33.5 ms, but it remains **FAIL** against ≤20 ms. The smaller shadow map is retained; no physics, terrain or animation cadence was reduced. Draw calls fell to 135–157 per sampled frame, from roughly 539–646 before batching. [Batching-only measurement](evidence/m5-performance-batched.json). All eight retained seven peers with no sampled collisions and <2 MiB retained-heap growth per client. [Final eight-browser performance evidence](evidence/m5-performance.json). The rendering optimization is useful but does not resolve this measured load limit; do not infer a passed budget from fewer draw calls.

Normal two-player traversal at 1440×900: **PASS**, 30 seconds, p95 16.7–16.8 ms, 1,801 sampled frames per client, no page errors/collisions and both retained their peer. [Two-player performance](evidence/m5-two-performance.json). All local browser measurements used Chromium 153.0.8010.12 on Apple M4 Pro / macOS Darwin 25.6.0. Eight-browser measurement used 1280×800 per context for approximately 61 seconds. Neither run is a ten-minute soak.

The utility integration test first hit the intended follow-command cooldown, then an inherited two-player fixture limit at its late-join step; it was corrected to wait the cooldown and use the production eight-member capacity. The corrected real Redis/gateway run passed owner turnover during the channel, replay after generation replacement and full opened state for a late third member. No runtime authority check was relaxed.

Final functional browser run after batching: **PASS**, three scenarios in two minutes: four character direction/gait/wave checks (5.4 s), eight independent players with ninth-member refusal and resume (40.5 s), and full two-player slice (1.3 min). [Character directions](evidence/m5-directions.json), [eight-player correctness](evidence/m5-eight.json), [slice measurements](evidence/m5-browser.json), [vine passage](evidence/m5-vines.png), [channel](evidence/m5-channel.png), [Forest discovery](evidence/m5-forest.png). No page errors. Forest and character screenshots were visually reviewed.

**PASS** R1 renderer lifetime: twelve leave/re-enter cycles and four rapid initialization cancellations, stable listener/ticker counts and bounded retained heap, 7.2 seconds. [Lifetime evidence](evidence/m5-lifecycle.json). Compact HUD regression also passed (2.1 seconds); [small viewport](evidence/m5-hud-small.png). Historical evidence files were restored after copying these results to M5-specific paths.

After the final 1024² shadow change, typecheck and production build passed again. The final two-browser frame sample and full adventure walkthrough both passed (1.8 minutes combined); the updated Forest screenshot was inspected. Final normal-play evidence is [the 30-second two-player sample](evidence/m5-two-performance.json), while [the separate eight-browser sample](evidence/m5-performance.json) retains its failed budget result. The stable local runner remains available at https://astraworld.localhost:1355; create a fresh room.

## Remaining gates

- Human two-player first-time playtest feedback remains pending. The user was asked to try the route and report comprehension/pacing. A scripted 1.3-minute completion does not establish a satisfying 10–15 minute first session.
- The eight-browser frame-time gate is **unmet**. Next technical work is profiling GPU/frame scheduling under this load; batching and the smaller shadow map improved render cost without meeting the eight-window target. Normal two-player performance passes on this machine.
- No fresh ten-minute M5 soak, true TCP fault run, Safari/Firefox check or hosted M5 deployment was performed. Existing historical M1 fault evidence is not a fresh M5 result. No push, new service or permanent saving was introduced.
- Abrupt unobserved loss, including a disconnect notification missed during owner turnover, may use the existing three-second presence grace. Observed active-owner disconnect and connection-generation replacement are tested cancellation paths.

M5 is playable locally, **not fully accepted**. Resolve these gates before M6; no M6 code was added.

## Subsequent authorization

The user requested “deploy it and proceed to M6.” This explicitly authorizes releasing M4/M5 and beginning M6 despite the recorded outstanding M5 gates. Those measurements and human feedback status remain unchanged; this is an authorization to advance, not a claim that the gates passed.


### Subsequent authorized deployment

M4/M5 was committed and pushed as `93412cf` and deployed successfully to production (`dpl_92Z5Civ3rYxaVS7S2fDYZB3qU8Z5`). The [hosted two-player full journey](evidence/m5-hosted-browser.json) passed in 1.3 minutes. This resolves the hosted-journey check only; human playtest and the recorded eight-window frame-time failure remain open. The user separately authorized M6, whose [mission and results](M6_DURABLE_RELEASE.md) record Neon integration and recovery.
