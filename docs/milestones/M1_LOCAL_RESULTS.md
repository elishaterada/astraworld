# M1 local multiplayer results — 2026-09-06

**Current status: [M1 complete](M1_COMPLETION.md).** The dated results and then-pending checks below are historical; final TCP-loss and eight-player soak evidence supersedes their outstanding-gate notes. M2 has not started.


**Local reference implemented; deployed-host acceptance pending. M1 is not complete. Do not start M2.**

## Scope and revision

The user's “Great, next step” authorized the next roadmap milestone after M0. Added private two-member sessions, an authoritative Node/WebSocket runner, Redis fencing/checkpoints/presence, prediction, remote interpolation and reconnect status. Existing concept-inspired art and fullscreen entry remain. No gathering, inventory, combat, taming, crafting, building, Postgres, cloud provisioning or deployment.

Started from `0ea631f` plus the user's uncommitted M0 art refinement. The user committed that work during this task as `94cdb29` (“Improve world”), including dependency installation and the early M1 implementation note. Remaining M1 changes are uncommitted. No agent commit or merge was made. Historical M0 evidence is preserved; new regression evidence uses the `m1-regression-` prefix.

## Runtime and contracts

See [the implementation contract](M1_IMPLEMENTATION.md), [networking](../NETWORKING.md) and [architecture](../ARCHITECTURE.md).

- Node 24.13.0, macOS 26.6.2, Apple M4 Pro / 24 GB; Next 16.3.4, Pixi 8.20.1, Redis server 8.10.1, node-redis 6.2.1, ws 8.21.3, Zod 4.5.4.
- Local production frontend on `127.0.0.1:3002`; separate runner/gateway processes on 3101 and 3102, Redis on 6380. All bind loopback. Integration tests use disposable Redis on 6391 and gateways 3191–3194 under fresh `test:<uuid>` namespaces.
- Chromium 153.0.8010.12, 1440×900, DPR 1, accelerated Metal/ANGLE. Safari/Firefox and remote machines have not been checked.
- Username → server-issued session → fullscreen Meadow. Menu supplies a capability invitation for one friend. Invitations expire 30 minutes after creation. Membership/checkpoints live approximately 30 minutes after the last occupied tick; this is temporary session recovery, not durable saving. Explicit Leave forgets the tab's resume credential; reload in the same tab retains it. A closed tab has no promised identity recovery.
- Gateway checks allowed Origin, 8 KiB maximum, strict schema/version, room/credential binding, generation, sequence and a 30 messages/sec token bucket with capacity 40. Session creation has a per-gateway 20 requests/minute/IP cap; public distributed admission control is not implemented.
- Server uses latest input once per 50 ms step; traffic cannot request extra steps or positions. No input for 250 ms stops movement; after 3 seconds without input the actor leaves visible projections. Players collide with terrain, not one another.
- One Redis-fenced writer, 10-second lease / 3-second renewal. Every accepted 50 ms checkpoint and every 100 ms full projection are atomically fenced. The simulation's time step stays pure. Runtime delays skip ticks rather than run a movement catch-up burst.
- The client holds at most 40 pending inputs and six snapshots. Reconnect clears obsolete predictions and waits for a full projection. Old epochs and stale ticks are dropped. Invalid/delta messages request a full projection; M1 deliberately sends no deltas. Remote players hold when samples run out.

## Checks performed

| Check | Result |
| --- | --- |
| TypeScript and optimized Next build | PASS |
| Pure rules plus real Redis/WebSocket integration | PASS — 19 tests across four files |
| Browser coverage | PASS — six M0 regression scenarios, then three final M1 scenarios; long soaks invoked separately |
| N0: independent sessions, shared motion, third-player rejection | PASS locally; browsers connect to separate processes |
| N1: position/speed injection, malformed/version/size checks, flooding | PASS locally; invalid input rejected without moving at client-requested speed |
| N2: offline/reconnect, new generation, same actor, connection replacement | PASS locally; reconnect uses alternate gateway |
| N3: concurrent ownership, owner process SIGKILL, stale commit rejection | PASS locally; replacement acquired in 10.213 seconds; stale write failed |
| Redis unavailable | PASS locally; SIGSTOP stopped publication, SIGCONT permitted recovery without catch-up movement |
| N4: invalid delta, missing full messages and old epoch | PASS locally; resync requested and stale position not applied |
| Delayed network and five-second outage | PASS for application-message fault injection; see limits below |
| Ten-minute two-player traversal / forced rotations | PASS — 601.163 seconds, ten epochs across both processes |
| Deployed occupied-runner lifetime, duration expiry and deployment overlap | NOT RUN — external deployment gate remains open |

The network proxy carries actual traffic to the authoritative servers. It adds nominal 150 ms RTT with ±30 ms RTT jitter and drops every hundredth eligible application message in both directions. This is **not IP packet loss** and does not establish TCP retransmission/head-of-line behavior. The same correctness/recovery test also passed at 300 ms nominal RTT. Actual packet-loss/TCP retransmission remains unmeasured. Prediction was observed before the first round-trip acknowledgement. A five-second traffic outage froze/reconnected the client and restored the same character.

Integration evidence: [owner-crash measurements](evidence/m1-integration.json). Browser evidence: [two-player screen](evidence/m1-two-player.png), [session/reconnect measurements](evidence/m1-browser.json), [150 ms measurements](evidence/m1-degraded.json), [300 ms measurements](evidence/m1-degraded-300.json). Manual agent-browser inspection verified username entry, native fullscreen, rendered terrain, and invitation menu. There were no page exceptions in the successful gameplay test.

During testing, an ambiguous Playwright alert selector was corrected. Delayed reconnect testing exposed premature input with the prior generation; the client now resets generation before each new handshake. Review also corrected replaced connections to close terminally, preventing two tabs from repeatedly reclaiming the same actor.

## Sustained-run measurements

[Ten-minute evidence](evidence/m1-soak.json): two independent Chromium contexts connected to different gateway processes, 1440×900 / DPR 1 each, the same Meadow seed and two actors, 2,924 baseline blockers and 263–335 visible props. Both traversed with real keyboard input while the gateways rotated ownership every 60 seconds.

- 601.163 seconds; 35,984 and 35,951 measured frames. Both p95 frame intervals were 16.7 ms, maximum 16.8 ms, zero recorded intervals above 20 ms.
- Ten observed epochs, alternating `local-a` and `local-b`. Both actors remained collision-free and visible to each other at all 60 sampled checkpoints. No page errors, rejected gameplay messages or rejected current-owner commits.
- Post-GC heap samples remained bounded: approximately 19.08–19.60 MB and 18.94–19.50 MB, with decreases during the run rather than monotonic growth.
- Pure movement CPU p95: 0.0191 ms and 0.0165 ms on the two owners. This excludes Redis I/O and serialization. 11,836 committed steps total (about 19.69/sec including ownership handoffs); no queued tick backlog exists in this adapter.
- Outbound application payload averaged about 5.3 KiB/sec per client, below the provisional 50 KiB/sec budget. WebSocket/TCP framing is not counted. Redis command totals and deployment-region latency were not instrumented.

World metadata now pins `meadow-1` / `placeholder-1`; mismatched rooms are rejected at admission and by the runner.

The [soak source hashes](evidence/m1-soak-source-sha256.txt) identify the measured runtime. After that run, the room metadata gained explicit generation/content version guards and formatting was normalized; these are covered by the final integration/browser checks. The ten-minute measurement was not rerun for those admission-only guards; movement/rendering behavior is unchanged.

## Hosting gate and next work

The Vercel CLI is authenticated as `elishaterada`; `vercel project ls` found no projects in the current `elisha-teradas-projects` scope. This repository has no linked `.vercel` project, configured deployed gateway, or cloud Redis namespace/endpoint. No services were provisioned and no app was published.

Current [Vercel WebSocket documentation](https://vercel.com/docs/functions/websockets) was checked on 2026-09-06: Node HTTP/ws endpoints are supported in beta; connections stay on one instance, end at function duration, and reconnects may reach another instance. That documentation is not runtime evidence for this runner.

Next task remains **M1 deployed-host validation**: select an authorized test project and co-located Redis service, configure isolated credentials/origins/TLS and endpoint routing, adapt the Node server export to the chosen host, and force occupied-runner rotation, maximum duration expiry and deployment overlap. Measure renewal failures, Redis operation load, cross-instance reconnection and recovery time on the actual host. If that host cannot keep an occupied runner valid, record measured failure and choose the documented long-lived runner fallback before provisioning it.

The local runner binds loopback and is not packaged as a production deployment. The client defaults to local HTTP/WS; remote use requires configured HTTPS/WSS endpoints. Redis Cluster is not supported by the room-creation transaction (the invitation index is outside the room hash slot); use a standalone Redis service for this reference. Current bearer credentials are opaque Redis-backed session capabilities, not account authentication or short-lived signed access tokens. Public abuse protection, credential refresh policy and deployment health/lifecycle wiring still need host-specific validation. No persistent-world claim is made.

Final verification: `npm test` passed 19 tests (15.96 s); `npm run build` and `npm run typecheck` passed. Final M1 browser checks passed all three scenarios (47.6 s). Earlier M0 regression checks passed all six scenarios. Prettier and `git diff --check` passed. The local production frontend and both gateways remain running; the gateways use a 60-second forced-rotation interval for the demonstrated reference.
