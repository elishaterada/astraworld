# M1 deployed-host verification

The user authorized committing/pushing and continuing on 2026-09-06. `90ae2da` was pushed to `origin/main`; the Vercel Git integration produced a Ready production deployment in `teradas/astraworld` (deployment `dpl_4H11V4QezYxfMmRvUJMHvUk7Po6U`). The project has an existing encrypted `REDIS_URL` in Production and Preview. No new service was provisioned.

The follow-up adds Next.js route handlers using Vercel's experimental WebSocket upgrade API and the existing gateway/runner. Hosted browsers use same-origin `/api/meadow`; local browsers retain the two loopback gateways. Sessions enforce same-origin, schema, body-size and admission-rate checks. WebSocket admission uses the same generation/credential/intent validation as the local transport, with an 8 KiB payload limit.

Hosted functions have a 60-second maximum duration; room ownership rotates at 45 seconds for the lifecycle experiment. Production uses `production:astraworld-m1`; previews use `preview:astraworld-<commit>`, sharing the existing Redis service without sharing room keys. The Redis URL remains server-only. This namespace separation does not provide a separate Redis failure domain.

Production is protected by Vercel authentication. The initial unauthenticated browser visit reached its login page. Deployment Ready does not establish gameplay or lifecycle correctness. Hosted health, authenticated independent browsers, expiry/overlap and Redis latency checks remain pending until verified and recorded below. M2 remains out of scope.

The adapter deployment (`e581253`) reached Ready. Authenticated health returned HTTP 200 with `ready:true`. Two independent protected browser contexts joined through actual hosted WebSockets, but the initial lifecycle run showed frequent transient reconnects; this is a failed stability check, not M1 acceptance.

Review identified that a valid next intent arriving while a Redis write was pending was treated as invalid traffic. The gateway now keeps one bounded latest-intent slot while I/O is in progress. Rate/schema/generation/sequence checks still apply to every received frame; simulation still steps once per server tick. A delayed-adapter regression exercises 120 ms writes with normal 50 ms input. Hosted health also reports Redis ping latency and runtime region for the placement investigation.

`ae99f41` was rejected by Vercel's build because the new health error branch referenced a variable outside its scope. `25275dd` corrected that error, passed the local production build and deployed successfully. Authenticated health measured 21.18 ms Redis round-trip latency in `iad1`.

The second 150-second hosted run (`m1-hosted-coalesced.json`) kept both players connected during ordinary play, with approximately 20 committed simulation ticks/sec between transitions. It observed five epochs and different owner processes as 60-second function lifetimes ended. Both players resumed the same identities. There were no page exceptions. Recovery was sampled only every ten seconds, so this does not establish a precise recovery-time bound or deployment-overlap acceptance.

The next refinement reads metadata, membership, inputs, checkpoint and Redis time in one atomic Lua invocation. This removes mixed-read races and reduces command overhead while preserving the pure step and fenced-write contract. The local 22-test suite and production build passed with this change.

The hosted verifier now records per-second identity, generation, epoch, owner, gateway and collision samples. Gateway diagnostic IDs include the deployed commit prefix. The overlap run starts on `91ddbda`; a documentation-only push during the run creates the second deployment. One browser then reloads through the new deployment while the other keeps its existing connection. Results and precise sampled recovery bounds will be recorded after completion.

The first per-second overlap run observed simultaneous gateways from `91ddbda` and `f66d0ed`, consistent owner/epoch projections, unchanged identities and no collisions. It failed the 15-second recovery target with a 16,042 ms gap. The client was closing an already authenticated connection after three seconds without snapshots, causing repeated handshake/backoff cycles while the previous owner's ten-second lease remained valid. The watchdog now allows an authenticated socket 15 seconds to wait for ownership recovery; unauthenticated handshakes retain the three-second bound. Reconnect feedback still starts after one second. See `m1-hosted-overlap-first.json` for the failed run.

The authenticated-connection watchdog change passed 24 tests and the production build. It was deployed as `bbaa99a`. The final overlap exercise starts both browsers on that revision and rolls a documentation-only deployment while they remain active. The per-second verifier requires recovery in less than 15 seconds, stable identities, collision-free positions, consistent ownership for matching epochs, and gateways from both commit prefixes.

## Final deployed lifecycle result

**Hosted lifecycle and deployment-overlap gate: PASS. Overall M1 transport acceptance remains pending one true TCP packet-loss test. M2 has not started.**

The final verifier ran two independently authenticated browser contexts against `https://astraworld-teradas.vercel.app`, beginning on `bbaa99a` and spanning the live rollout of `7db14c1`. Production retained Vercel authentication; testing used its automation access mechanism without exposing the bypass credential in code or evidence.

- Both clients connected, saw one another, and retained their server-issued identities across reload, function expiry and deployment overlap.
- A one-second movement held exactly 4.0 authoritative tiles in the measured clearing. Every sampled position was collision-free.
- Four owner epochs were observed. The gateway IDs proved traffic through both deployed revisions. Matching epochs always reported the same owner, including periods with clients connected to different deployments.
- Longest sampled reconnect/presence gap: **10,026 ms**, below the 15,000 ms target. Sampling is approximately once per second, so this is a measured sampled bound, not a sub-millisecond timing claim.
- No browser page exceptions. Final local checks: **24 tests PASS**, TypeScript/production build PASS, and all three client browser regressions PASS (42.6 seconds), including 150/300 ms RTT, application-message loss and a five-second outage.

Evidence: [final per-second samples](evidence/m1-hosted-final.json), [hosted screenshot](evidence/m1-hosted-final.png), and the `m1-hosted-client-regression-*` artifacts. Failed experiments are retained separately and are not counted as passes. The reproducible harness is `scripts/verify-hosted.mjs`; configure `HOSTED_URL` and optionally `HOSTED_ACCESS_FILE` pointing to a private JSON file with the automation `secret`. Set `HOSTED_OVERLAP=1` and make a documentation-only push during the run to exercise different revisions. Never commit that access file or its credential.

Remaining check: real TCP/IP packet loss and retransmission/head-of-line buffering. The existing proxy drops application messages, which is a different fault model. Noninteractive administrator access is unavailable on this Mac (`sudo -n true` reports that a password is required), so no packet-filter changes were attempted. Complete that check in a controlled network test environment before treating the full M1 transport matrix as accepted or starting M2. No additional cloud services were provisioned.

## Protocol 2 responsiveness follow-up

Runtime `dc7ec84` deployed on the existing Vercel project and Redis service. The new two-browser hosted movement/facing/wave checks passed, including added 300 ms application RTT, a dropped action message and five-second application outage. See [the current contract and verification status](M1_RESPONSIVENESS.md). The earlier protocol-1 10-second gap measurements in this document remain historical evidence; they must not be presented as protocol-2 results.

Protocol-2 hosted renewal / real deployment overlap also **passed**: 260 seconds, two independent authenticated contexts, owners spanning `dc7ec84` and `419c3c7`, preserved identities, approximately 59.95 Hz simulation and a maximum observed snapshot gap of 320.4 ms. See [raw lifecycle measurements](evidence/m1-v2-hosted-lifecycle.json). These measurements do not replace true TCP-loss testing or establish a worst-case latency guarantee.
