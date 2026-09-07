# Testing and acceptance criteria

## Current status

M0 now has executable pure-rule and Chromium gameplay tests. See [M0 completion evidence](milestones/M0_COMPLETION.md) and the commands in [README](../README.md). G0/R0/R1 cover the local sandbox; all later matrix rows remain future requirements. Server CPU, network faults, contention, permission and recovery checks are inapplicable until their systems exist.

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
| N0 / M1 | Two independent browser sessions join | Two authorized actors see consistent motion; third unauthorized identity rejected |
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

Visual review checks text legibility, target overlap, friendly/hostile distinction, attack tells, reduced-motion options and input focus. Inspect original approved promo before final art acceptance; it is unavailable in this package. Keep failures visible in the milestone note, with reproducible steps and actual observed outcomes.

## M1 executable coverage

`tests/network.test.ts` launches real disposable Redis and real WebSocket gateways: schema/size validation, invitation contention, forged identity, lease fencing, stale generation, movement timeout, input flood, Redis pause/resume and SIGKILL owner recovery. `tests/e2e/multiplayer.spec.ts` uses independent browser contexts and distinct gateway processes for join/motion/reconnect. A real-traffic WebSocket proxy exercises delayed and lost application messages, stale epochs, invalid delta and a five-second outage. This proxy does not simulate actual TCP packet loss.

`tests/e2e/multiplayer-soak.spec.ts` is explicitly invoked with `npm run test:multiplayer-soak`; both gateways must run with `ROTATION_MS=60000`. It measures two-client frames, memory and repeated planned owner changes. M0 regression checks run with `?solo=1` and write separate `m1-regression-*` evidence to preserve historical artifacts. The [M1 result](milestones/M1_LOCAL_RESULTS.md) is authoritative about passed and still-pending gates.


`tests/e2e/characters.spec.ts` covers the M1 entry selector, clipboard invitation, two independent identities observing matching cosmetics and real movement, plus reload/resume. Its default evidence prefix is `m1-character`; `CHARACTER_EVIDENCE_PREFIX` can preserve a separate hosted run. For protected hosted verification, `HOSTED_ACCESS_FILE` may point to a private JSON file containing the Vercel automation `secret`; never store it in Git. [Character update results](milestones/M1_CHARACTERS.md) record checks and limitations. Existing game-canvas assertions are scoped to `.playfield canvas`, excluding entry portraits.
