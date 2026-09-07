# Testing and acceptance criteria

## Current status

M0 and M1 have executable pure-rule, integration and Chromium gameplay checks. [M1 completion](milestones/M1_COMPLETION.md) records passed N0–N4, hosted lifecycle/overlap, true TCP packet loss and the ten-minute eight-player soak. M2 gathering was subsequently authorized and its I0/I1 evidence is recorded below. M3 onward remain future requirements.

## Test layers

- Pure rules tests: fixed-step movement, collision, attack timing, taming and content validation with explicit expected outcomes.
- Generation tests: stable outputs, multiple chunk orders and progression reachability across 100 fixed seeds.
- Integration tests: real Redis/Postgres in isolated test namespaces when introduced; contention, fencing, dedupe, transactions and recovery.
- Browser tests: independent sessions performing the real player flow through UI and network. Use developer network controls or a fault proxy for latency/loss; do not fake server authority inside the browser.
- Human playtest: first-time comprehension, telegraph readability, taming affordance and value of the gate unlock.

## Acceptance matrix

| ID / milestone | Scenario | Pass condition |
| --- | --- | --- |
| G0 / M0 | Same seed in different chunk load orders | Identical terrain, collision and stable object IDs |
| R0 / M0 | Walk diagonally, along walls and after resize | Bounded speed, no wall penetration, correct camera/target transform |
| R1 / M0 | Unmount/remount canvas | No duplicated ticker/input listeners or persistent resource growth |
| N0 / M1 | Up to eight independent browser sessions join | Eight authorized actors see consistent motion; ninth member and invalid credentials rejected |
| N1 / M1 | Forged position/speed and malformed payload | No authority change; invalid traffic is rejected/rate-limited |
| N2 / M1 | Disconnect and reconnect to another gateway | Same character, new session generation, full resync and no ghost duplicate |
| N3 / M1 | Owner expiry, crash and stale-owner return | One active fenced owner; stale writes fail; room resumes |
| N4 / M1 | Lost delta base and old epoch snapshot | Client requests fresh state and does not apply corrupt/stale projection |
| I0 / M2 | Simultaneous final-node harvest | One reward and one depletion; losing player receives rejection |
| I1 / M2 | Replay action/full inventory/out-of-range | No duplicate reward, no invalid depletion or negative quantity |
| C0 / M3 | Attack across many active ticks | At most one hit per target per attack instance |
| C1 / M3 | Wall, dodge, cooldown and death edge cases | Server rules hold and clients converge on health/state |
| T0 / M4 | Feed three times with command retries | Exactly three consumed berries and one owned entity |
| T1 / M4 | Two players feed same creature | One claim/owner; loser consumes nothing |
| T2 / M4 | Claim expiry, owner disconnect, chunk reload | Documented progress expiry; no second wild copy; session ownership restored |
| T3 / M4 | Follow around obstacles; recall near locked gate | No wall spawn or progression bypass; companion recovers visibly |
| U0 / M5 | Open gate with valid/invalid companion | Only valid owner ability opens it; both clients get collision change |
| U1 / M5 | Interrupt/retry utility channel | No premature opening or duplicate effect |
| S0 / M5 | Fresh pair completes full slice | All MVP beats reachable without developer help |
| P0 / M6 | Kill process immediately after durable commit, before reply | Retry returns one result with no extra cost/reward |
| P1 / M6 | Delete test Redis data, restart server | Durable inventory, companion and edits recover from Postgres |
| P2 / M6 | Duplicate outbox delivery, stale checkpoint | Idempotent projection; durable revisions win |
| P3 / M6 | DB unavailable during action | No saved/success claim, no partial cost or reward |
| P4 / M6 | Restore isolated backup and old schema fixture | Documented recovery succeeds; identities and progression preserved |
| F0 / M7 | Craft concurrently/retry with near-full inventory | Ingredients/output conserved and committed once |
| B0 / M8 | Conflicting placement and chest transfers | One occupied footprint; total items conserved; permissions enforced |

## Performance and network test envelope

Record device model, OS, browser/version, viewport (initial 1440×900), device pixel ratio, seed, entity counts and deployment region with each result. Establish a representative laptop reference at M0; do not claim “all browsers” from one machine. Target current desktop Chrome first, then Safari and Firefox smoke checks before the persistent release.

Proposed budget for a 10-minute run: 60 FPS target with p95 frame interval ≤20 ms in ordinary traversal, p95 server simulation CPU step ≤25 ms within the 50 ms tick, no persistent tick backlog and no monotonic memory growth after repeated chunk travel. Report scene/entity counts so measurements are reproducible.

Test clean network plus 150 ms RTT, ±30 ms jitter and 1% induced packet loss. WebSocket/TCP may surface loss as delay; measure its effect on buffering. Local movement must respond immediately through prediction, remote entities must recover cleanly, and action outcomes must converge without duplication. Under 300 ms RTT or a 5-second outage, correctness and clear reconnect feedback take priority over smoothness.

Measure bytes/client/second, snapshot sizes, Redis operations, durable-command latency, lease renewal failures and owner recovery time. Initial targets: <50 KiB/s average outbound per client in the slice, <500 ms p95 confirmed action latency at 150 ms RTT, and room recovery within 15 seconds after owner loss under a healthy backend. If measurements fail, tune bounded workload and document the decision before changing budgets.

## Observability and manual review

Use correlation IDs for session, world, epoch and command; exclude tokens and unnecessary personal data. Log validation rejection categories, dedupe hits, tick overruns and commit failures. An in-development diagnostics overlay may show RTT/tick/corrections; player UI should say connecting/reconnecting/saved rather than expose implementation details.

Visual review checks text legibility, target overlap, friendly/hostile distinction, attack tells, reduced-motion options and input focus. Compare moving gameplay against the supplied reference in `docs/art-reference/early-game-concept.png` before final art approval. Keep failures visible in the milestone note, with reproducible steps and actual observed outcomes.

## M1 executable coverage

`tests/network.test.ts` launches real disposable Redis and real WebSocket gateways: schema/size validation, invitation contention, forged identity, lease fencing, stale generation, movement timeout, input flood, Redis pause/resume and SIGKILL owner recovery. `tests/e2e/multiplayer.spec.ts` uses independent browser contexts and distinct gateway processes for join/motion/reconnect. A real-traffic WebSocket proxy exercises delayed and lost application messages, stale epochs, invalid delta and a five-second outage. This proxy does not simulate actual TCP packet loss.

The historical two-player soak is `tests/e2e/multiplayer-soak.spec.ts`. The current eight-player soak uses `M1_EIGHT_SOAK=1` with `tests/e2e/eight-players.spec.ts` and normal 240-second socket renewal. It measures frames, retained heap, CPU, collision, identities and peer presence. M0 regression checks run with `?solo=1` and write separate `m1-regression-*` evidence to preserve historical artifacts. The [M1 result](milestones/M1_LOCAL_RESULTS.md) is authoritative about passed and still-pending gates.


`tests/e2e/characters.spec.ts` covers the M1 entry selector, clipboard invitation, two independent identities observing matching cosmetics and real movement, plus reload/resume. Its default evidence prefix is `m1-character`; `CHARACTER_EVIDENCE_PREFIX` can preserve a separate hosted run. For protected hosted verification, `HOSTED_ACCESS_FILE` may point to a private JSON file containing the Vercel automation `secret`; never store it in Git. [Character update results](milestones/M1_CHARACTERS.md) record checks and limitations. Existing game-canvas assertions are scoped to `.playfield canvas`, excluding entry portraits.

## M1 protocol 2 checks

`tests/realtime*.test.ts` covers frame validation, normalized movement, exact replay, time budgets, wave idempotency/cooldown, client batching, generation fencing and independent Redis-backed gateways. `tests/e2e/realtime.spec.ts` uses two independent authenticated browser contexts, added application delay, a dropped wave message and a sustained application outage. These do not simulate TCP retransmissions. `REALTIME_LIFECYCLE=1 LIFECYCLE_MS=26000` runs the browser renewal observation against local gateways started with `SOCKET_AGE_MS=20000`. Hosted observation uses the normal 240-second renewal and at least 260000 ms. See [current acceptance evidence](milestones/M1_RESPONSIVENESS.md).

## Eight-player M1 capacity

`tests/capacity.test.ts` verifies atomic cross-gateway admission under 20 competing joins, the eight-actor schema bound, safe spawn slots and retained resume credentials. `tests/e2e/eight-players.spec.ts` opens nine isolated contexts: eight play together, a ninth is refused, and a member resumes the full room. It checks accepted server position before waiting for the next rendered frame. Run with the normal local services and `BASE_URL=http://127.0.0.1:3002`; private hosted automation access is optional. [Local and hosted results](milestones/M1_EIGHT_PLAYERS.md) distinguish this focused capacity test from unrun eight-player soak and TCP-loss checks.

## Four-character art checks

`tests/character-art.test.ts` validates the four IDs and separate RGBA sheets with disjoint bounded frames. `tests/e2e/character-art.spec.ts` exercises each look's front/back/side walking and idle textures in solo mode. The existing character selector test checks four distinct nonempty portraits; the eight-player test now uses all four designs, verifies actual rendered direction frames across observers and resumes Hazel. [Results and limitations](milestones/M1_CHARACTER_ART.md) preserve the earlier milestone evidence.

## Real TCP fault gate

Manually dispatch `.github/workflows/m1-network.yml` on the public repository's isolated Ubuntu runner. It builds and checks the app, then runs `tests/e2e/tcp-network.spec.ts` with receiver-ingress netem affecting only local gateway TCP ports. It verifies 150/300 ms RTT with jitter and 1% actual packet loss, a five-second outage, accepted actions, peer convergence and bounded recovery. Kernel queue counters, TCP retransmission fields and browser measurements are retained as artifacts; no raw packet payloads or production credentials are uploaded. See [final validation](milestones/M1_FINAL_VALIDATION.md). Do not run the privileged fault script on a general-purpose host.

## 3D visual migration before M2 — 2026-09-07

`tests/visual-3d.test.ts` compares targeting math against a real orthographic camera and inspects model orientation/limb transforms, including reduced motion. `character-art.spec.ts` now checks actual 3D rotation/gait/waves; `eight-players.spec.ts` checks rendered model direction rather than sprite frame indices. Character RGBA asset tests retain historical source validation only.

The focused renderer load check uses `VISUAL_3D_PERF=1` with `eight-players.spec.ts`: eight real contexts traverse for 60 seconds, measure p95 frame intervals, renderer resources and retained heap. This does not replace the ten-minute M1 soak or claim its duration. Use `EIGHT_EVIDENCE_PREFIX` and `CHARACTER_EVIDENCE_PREFIX` to isolate migration outputs. [Results and limitations](milestones/VISUAL_3D_MIGRATION.md).

## Living Meadow environment

`tests/environment.test.ts` covers landmark collision, open spawn/main paths and old-world hello rejection. The 100-seed generator suite verifies all dry ground stays reachable and pins `meadow-2 / environment-1`. `tests/e2e/environment.spec.ts` uses two independent authenticated sessions approaching pond/fire blockers through real input and checks authoritative/remote agreement; it also checks reduced-motion effects. `VISUAL_PERFORMANCE_EVIDENCE` selects the focused performance output file to preserve prior evidence. G0 screenshot equality now explicitly uses reduced motion so animated atmosphere does not invalidate deterministic geometry checks. [Results](milestones/LIVING_MEADOW.md).

## M2 executable coverage

`tests/gathering.test.ts` covers content, stacking, contention, retry, invalid range/tool/line/cooldown/capacity, deterministic 100-seed resource minimums and compact overlay recovery. `tests/gathering-network.test.ts` uses real Redis and two gateways for atomic receipts, duplicate retries, generation replacement, owner fencing and backend pause/recovery. `tests/e2e/gathering.spec.ts` races two authenticated browser contexts, checks shared depletion, harvests a tree and reloads inventory. See [M2 results](milestones/M2_GATHERING_INVENTORY.md) for executed checks and limitations.

## M5 executable coverage

`tests/utility.test.ts` covers permission/target/line/range/cooldown, exact channel boundary, disconnect/generation/death/combat/range/mode cancellation, competing owners, retries and recall across the actual closed/open Forest gate. `tests/world.test.ts` verifies 100 seeded progression graphs both closed and open. `tests/utility-network.test.ts` uses real Redis/gateways and authenticated input to tame, travel, open during owner turnover, replace the connection, replay and admit a late observer. `tests/e2e/slice.spec.ts` uses a fresh pair and actual keyboard/UI flow through gathering, combat/dodge/respawn, taming, blocked traversal, observed-disconnect channel cancellation, shared opening, traversal and reconnect. It includes 150 ms added application RTT, not true TCP loss. [M5 evidence and pending human acceptance](milestones/M5_COMPANION_UTILITY.md).
