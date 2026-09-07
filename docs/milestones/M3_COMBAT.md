# M3 combat mission — 2026-09-07

Authorized by “lets implement” after the M3 proposal. Active scope: one starter blade, dodge, hostile Slime, health, death and safe respawn. Stop before M4.

## Decisions and acceptance

Implement in content/simulation/protocol, the existing room runner, prediction adapter and Three.js presentation. No new dependencies or services. Preserve the compact HUD and Portless launch.

The north trail hosts one hostile Slime at (64.5,48.5), away from safe spawn. Blade attacks lock facing, use 9 windup / 6 active / 21 recovery ticks at 60 Hz, deal 10 damage once per target. Players have 100 health; the Slime has 30. Only hostile Slimes are eligible targets; no PvP. The Slime warns for 30 ticks before a fixed ground-circle impact, then recovers for 45 ticks. Chase is bounded to its habitat. Defeat is a retained tombstone with one death tick; no loot and no automatic respawn.

Dodge lasts at most 15 ticks, consumes at most 15 movement frames at 10 units/sec, grants 9 ticks of invulnerability and has a 60-tick cooldown. Both server time and frame budget bound it; missing inputs may shorten travel, never extend it. Terrain uses the existing swept collision. No historical rewind. Death cancels actions and respawns after 120 ticks at the member's safe spawn, retaining inventory, with 120 ticks of spawn protection.

Only intents travel upstream. Health, hits, cooldowns, Slime state and deaths share the existing fenced checkpoint/publication. Reconnection preserves committed combat state. M3 rooms use an isolated content/capacity namespace; create fresh invitations. Client prediction applies movement/actions only, never damage or loot.

Validate pure lifecycle, single hits, walls, cooldowns, dodge bounds, death and retained items; strict forged-message rejection; real gateway recovery; rendered combat with two authenticated browser contexts and 150 ms added RTT. Record exact evidence and limitations here after running checks. Offline `?solo=1` remains the M0/M2 regression harness; combat uses ordinary multiplayer entry.

## Results

**PASS within the local test envelope.** Based on clean commit `adabdfd`; M3 is being released through the existing Git integration following the user’s “lets do that” request. Hosted verification is pending below. No new dependency, cloud service or credential was needed.

- `npm run typecheck`: PASS. `npm test`: **53 tests / 17 files PASS** (final complete suite 16.44 s). `npm run build`: PASS with Next.js 16.3.4.
- `tests/combat.test.ts`: six focused tests cover windup/active/recovery, facing lock and single hits, range/arc, exact segment-versus-tile wall blocking including tiny diagonal corner crossings, tool permission, dodge travel/time/cooldown/invulnerability and wall collision, death cancellation, retained inventory, safe respawn, single defeat tombstone, disconnected-target exclusion, leash return, action batching/conflicting replay and forged outcome rejection. Existing movement, protocol, inventory, contention and lifecycle tests also pass.
- `tests/combat-network.test.ts`: two real gateways with disposable Redis and independently authenticated WebSockets pass damage agreement, partial-damage checkpoint recovery, owner fencing, new connection generation, retained inventory and one defeat tick surviving another owner turnover. No mock players are injected into the room.
- `BASE_URL=https://astraworld.localhost:1355 npx playwright test tests/e2e/combat.spec.ts`: PASS, final fresh-runner run **33.8 s**, Chromium **153.0.8010.12** on macOS. Two isolated authenticated browser contexts use actual movement, gather, aim, blade and dodge controls. The second browser adds 75 ms to sends and 75 ms to message callbacks (150 ms added application RTT). Both see the warning and agree on damage/defeat. Dodge is replicated; death returns the player to camp with the same inventory; reload retains defeat and inventory. No page errors. [Recorded results](evidence/m3-browser.json), [warning](evidence/m3-telegraph.png), [blade windup](evidence/m3-blade.png), [recovery](evidence/m3-recovery.png), [defeat](evidence/m3-defeated.png). Screenshots were visually inspected; the Slime silhouette was enlarged for visibility behind an approaching player.
- `BASE_URL=https://astraworld.localhost:1355 EIGHT_EVIDENCE_PREFIX=docs/milestones/evidence/m3-eight npx playwright test tests/e2e/eight-players.spec.ts`: PASS, **40.9 s**. Nine isolated contexts prove eight admitted, ninth rejected, all seven peers visible, movement/facing/waves synchronized and a full-room member resumed with the same appearance/position. Both local gateways are exercised through their Portless names. [Results](evidence/m3-eight.json), [scene](evidence/m3-eight.png). This is a capacity/rejoin smoke, not an eight-player combat soak.
- Gathering browser regression: PASS, final **6.3 s**, two contexts, competing berries, shared tree depletion and inventory resume. [Results](evidence/m3-gather-browser.json), [satchel](evidence/m3-gather-berries.png), [tree](evidence/m3-gather-stump.png).
- Compact HUD browser regression: PASS, **2.0 s**, inventory hidden until opened, first-play movement guidance shown once in solo, pause/close restores keyboard focus, small viewport checked. [Play](evidence/m3-hud-play.png), [satchel](evidence/m3-hud-satchel.png), [small viewport](evidence/m3-hud-small.png).
- Portless fresh launch and agent-browser entry review: PASS; username, four character choices and Enter Meadow render. The live local runner was restarted after the final collision change, then combat and gathering were reverified. `npm run dev` remains running at **https://astraworld.localhost:1355**.

The deliberate `combat-1` identifier change updates the locked terrain/ID hash to `dde9569c5be08924747ec6f206c35dd6946bb8fccf3ea4c073b6cc26c2a7bcf6`; terrain geometry is unchanged. Initial failures exposed old version/hash fixtures, a wave reconnect regression (fixed without resetting combat cooldowns), an early hydration race in browser-test setup (now waits for the invite UI), and the eight-player test's removed verbose HUD selector (now checks the compact party count). All cited final runs pass. Historical M1/M2 evidence was restored; new evidence uses `m3-` names.

## Limitations and next task

Combat is enabled in ordinary multiplayer entry; `?solo=1` intentionally retains its earlier regression harness. There is one hostile encounter and no healing, drops, additional weapons, taming or M4 implementation. The Slime uses direct swept steering within its habitat, not general obstacle pathfinding; it can be impeded by terrain when lured off the central trail. There is no historical hit rewind. Added application RTT verification is not TCP packet-loss testing, a WAN fairness guarantee, or a repeat of the ten-minute soak. Safari/Firefox, M3 hosted lifecycle/latency and sustained eight-player combat performance remain unverified. Existing M1 hosted evidence is historical and is not relabeled as an M3 result.

Recovery is the existing temporary Redis checkpoint (about 30 minutes); Redis loss is not durable saving. A missing input may shorten a dodge, and pause menus do not pause the shared world or protect an adventurer from an already nearby enemy. Dead players keep their items; defeat tombstones persist only within the temporary room. Create a fresh Meadow and invitation for M3; old M2 sessions are isolated.

Next: user playtest and, when requested, commit/push plus a hosted combat smoke. M4 taming/following is the next gameplay milestone and requires a separate request. Stop here.


## Hosted release

Commit/push and two-player hosted combat verification authorized on 2026-09-07. The combat browser harness now accepts the same private automation-access file as the existing gathering tests and writes separate hosted evidence. Results pending.
