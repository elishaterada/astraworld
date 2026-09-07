# Multiplayer responsiveness research

**Follow-up decision:** the user selected Vercel only. The external-host proposal below is historical and was not adopted. See the [implemented M1 responsiveness contract](../milestones/M1_RESPONSIVENESS.md) for the actual architecture and measured evidence.

Research date: 2026-09-06. Repository inspected at bc9bc32. Scope: M1 networking and game feel; no M2 gameplay, service provisioning or runtime changes in this research task.

## Recommendation

Adopt the user's experience requirement: local input should produce immediate local presentation. Use client prediction, server reconciliation, buffered remote rendering and bounded network sends. Keep shared outcomes validated by the world authority. The browser can begin an animation or predicted movement before the server confirms an outcome; this does not require making the browser the final authority for damage, awards or contested world changes.

Use throttling/coalescing/batching for continuous state, not trailing-edge debounce. A debounce timer repeatedly reset by movement can postpone transmission until the player stops. Start/stop and discrete action events need timely delivery. Dropping obsolete movement samples is different from dropping an attack or reward command. No reviewed primary source establishes that the named games solve responsiveness through debounced server relay.

## What the sources establish

### Path of Exile / Path of Exile II

Grinding Gear Games' [2015 explanation by Chris](https://www.pathofexile.com/forum/view-thread/1262596) explicitly distinguishes lockstep (wait for server confirmation; latency becomes input delay and stalls) from client prediction (show actions immediately, with possible divergence). This is **PoE 1 historical evidence**, not proof of PoE II's current implementation. GGG's [2016 performance manifesto](https://www.pathofexile.com/forum/view-thread/1642228) explains that lockstep simulation pauses when network data is late, even while visual effects can continue.

A relevant PoE II primary interview exists: [Zizaran interviewing Jonathan Rogers, networking segment starting approximately 1:28:10](https://www.youtube.com/watch?v=4lB3TM5FrsY&t=5290s). The original YouTube page metadata confirmed the title and creator. Primary caption retrieval returned an empty response; automated web retrieval was also blocked. A third-party transcript surfaced a pre-launch discussion of a predictive/lockstep hybrid for direct control. Treat this as a **research lead**, not independently verified evidence of the current shipped algorithm. Community suggestions to edit networking configuration conflict and are not technical authority.

I did not verify PoE II's current send rate, rollback window, transport, server tick or detailed reconciliation algorithm. Do not attribute invented values or our proposed architecture to GGG.

### Sephiria

Team Horay's [Future Updates Preview, May 12, 2025](https://store.steampowered.com/news/app/2436940/view/529846144626329413) reported late-game communication saturation, an estimated limit around 5 Mbps in their use of Steam networking, and latency spikes up to 2,000 ms. It discussed EOS as an option, not a completed migration. These are their historical measurements/estimates, not a universal Steam limit.

The developer's [0.11.7 update, April 16, 2026](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1830163047257153) reports prioritizing P2P communication to alleviate latency. Both announcements were verified directly in Steam's public news API for app 2436940 after the HTML news page returned little readable content. This supports investigating communication volume and connection routing; it does not prove client authority, debounce, a particular prediction algorithm, or that all latency problems were solved.

### Secrets of Grindea

[Developer Teddy's July 15, 2015 response](https://steamcommunity.com/app/269770/discussions/0/535150948594450841/) explains that the game used no official game servers: players connected directly through IP/Lidgren or Steam, with one player hosting and a somewhat higher network load on the host. This is historical developer confirmation of the topology, not a current detailed netcode specification. It does not establish that every client is authoritative or that actions are debounced. I did not find a verified full prediction/reconciliation design from Pixel Ferrets.

### Applicable implementation reference

[Glenn Fiedler's Snapshot Interpolation](https://www.gafferongames.com/post/snapshot_interpolation/) demonstrates that rendering every packet on arrival stutters under jitter, even with high send rates. Buffering snapshots and interpolating between them trades some remote-view delay for smoother presentation. Its example rates and buffer sizes are workload-specific; do not copy them as universal settings. Its UDP assumptions also differ from our browser WebSocket transport.

## Current Astraworld findings

These are repository observations and engineering inferences, not claims about the other games.

1. `app/network.ts` already predicts local movement and replays pending inputs. This is not an entirely server-waiting client. However, `advance` combines prediction and sending; prediction runs only when Connected with an open socket and stops once stale snapshots change that status.
2. `app/renderer.ts` samples movement through a 20 Hz fixed update, then interpolates previous/current local states. That smooths frames but adds response delay. Rendering at 60 FPS alone does not make input prediction run at 60 Hz. The exact input-to-display delay needs measurement.
3. Reconciliation replaces the predicted position and replays one fixed step per unacknowledged input message. The server instead holds latest input, may replace intermediate messages, advances independently and acknowledges the latest observed sequence. Receipt of that sequence is not proof that every earlier client simulation step was consumed. This timing mismatch is a plausible source of corrections under jitter. It must be tested with controlled schedules; simply changing send frequency would make the coupling worse.
4. There is ordinary frame interpolation but no separate correction offset that gently decays small reconciliation errors. Camera follows corrected local state, potentially making small corrections visible across the whole scene.
5. The server awaits a Redis input write; each room tick awaits Redis read and fenced checkpoint/publication. A busy room skips timer callbacks instead of catching up. These I/O waits can affect simulation cadence. The very small recorded pure-step CPU measurement excludes Redis waits and is not an end-to-end tick-latency measurement.
6. Hosted configuration explicitly rotates owners at 45 seconds and uses a 60-second function duration. The previous hosted test measured a 10,026 ms recovery gap. That meets the old resilience limit of 15 seconds but is unsuitable as a normal smooth-play experience. See `docs/milestones/M1_DEPLOYMENT.md` for the original evidence; the whole gap has not been isolated to one cause.
7. The old two-player soak measured roughly 5.3 KiB/s outbound per client. This does not establish network saturation as our present bottleneck. Measure packet timing, queue age, full tick time and correction distance before optimizing byte packing.

## Proposed M1 increment

This is a proposed implementation sequence, not a claim that the work is already implemented.

1. Add input-to-first-visible-response, end-to-end tick interval, RTT/jitter, snapshot age, correction distance, queued bytes and owner-transition gap measurements. Use an automated traversal plus deliberate turns/stops at 0/150/300 ms RTT. Preserve actual TCP-loss testing as a distinct gate.
2. Separate prediction, rendering and transport clocks. Target prompt local response at a 60 Hz client update, using a shared movement time contract that preserves collision and diagonal-speed invariants. Keep bounded speculative motion during brief stalls, then communicate reconnecting; do not allow unlimited offline divergence. Exact prediction horizon remains to be measured.
3. Define sequence/tick acknowledgement and time-bounded input processing before reducing send frequency. Acknowledge processed simulation history, not merely the newest received movement state. Test missing/coalesced inputs, reused held input, turns, key releases and replay after corrections. Neither batching nor client-provided timestamps may grant extra simulation time.
4. Start with a capped approximately 20 Hz input-send budget, immediate important transitions within a burst allowance, coalesced continuous movement and a separate low-rate idle heartbeat. Send snapshots at an initially measured 10–20 Hz and buffer by server tick/time with adaptive jitter delay. These are Astraworld experiment settings, not the named games' confirmed settings. Never debounce a key release or valuable action. Update the current 250 ms input timeout/3-second presence rules coherently with any heartbeat changes.
5. Smooth small visual corrections while preserving collision-correct simulation; snap truly invalid positions. Animate remote gait/direction locally from accepted motion. Camera and local effects should respond locally.
6. Prototype the existing long-lived regional room-server fallback. Keep Next.js and assets on Vercel. A stable in-memory room loop can separate movement cadence from storage round trips; retain externally fenced ownership, recovery checkpoints and validated significant outcomes. Removing an awaited write alone is not safe: publication and recovery must still prevent stale owners from committing state. No provider or paid service is selected or provisioned by this note.

A player-hosted/P2P model is a legitimate alternative for private co-op, but entails host departure, browser background throttling, NAT/relay and trust decisions. The fact that Grindea or Sephiria uses player-to-player networking does not establish it as the best fit for Astraworld's intended shared world.

## Acceptance changes to propose

- Measure local input-to-visible response; provisional target p95 under 50 ms at 150 ms RTT on the reference browser, excluding initial join and sustained outage. Do not claim that target has passed yet.
- No periodic multi-second pauses during an ordinary two-player session. Runtime expiry/owner rotation must be reviewed as game-feel events, not only successful recovery events.
- At 150/300 ms RTT, turns and stops remain locally responsive, correction distance stays bounded, and two views converge without wall penetration or duplicate identities.
- Message volume stays bounded when a key is held or input events burst; idle traffic is separately measured. No loss of required discrete events.
- During a five-second outage, show bounded prediction/reconnect behavior, then restore the same identity and authoritative state. True TCP/IP loss testing remains pending.

Only this research note and a link from the networking document were added. No runtime tests or new gameplay performance measurements were run for this research task; previous test results are cited as previous evidence.
