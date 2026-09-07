# M1 final validation work

Scope: finish the existing eight-player, four-character M1 sandbox. No M2 work. Earlier hosted lifecycle/rolling-deployment, authority, generation fencing, admission, collision, and character checks remain in their original evidence files. This note records the final network and sustained-load checks without relabeling historical runs.

## True TCP fault harness

`.github/workflows/m1-network.yml` is manually dispatched on the public repository's standard Ubuntu runner. It uses disposable local Redis, two gateways, the production Next frontend and independent Chromium contexts. It does not use production credentials or provision a game host. This avoids changing this Mac's network configuration, where noninteractive administrator access is unavailable.

`scripts/netem.sh` requires an explicit test flag and Linux. It redirects only loopback TCP traffic with game gateway source/destination ports 3103/3104 from receiver ingress through a dedicated IFB device. Frontend assets, Redis, GitHub control traffic and other ports remain unaffected. Both directions receive 75±15 ms uniform delay (150±30 ms nominal RTT) and independently sampled 1% packet loss; a second phase uses 150±15 ms per direction, then a five-second 100% loss phase. Queue counters and packet-header-only retransmission fields establish the fault actually happened. No WebSocket message interception/substitution is used. Raw captures are temporary and never uploaded; only selected TCP header fields and aggregate measurements are retained. Cleanup runs on success or failure.

Browser checks cover immediate local prediction, accepted wave acknowledgements, matching remote action sequence/facing/position, collisions, bandwidth and identity recovery. The normal profile requires p95 confirmed wave latency below 500 ms; outage recovery must be under 15 seconds. Browser movement timing is an automated observation, not an input-device-to-photon benchmark. Actual delay/loss samples are stochastic; nominal configuration is not an assertion that every RTT equals 150 ms.

Sources: [Linux netem options and receiver-ingress guidance](https://man7.org/linux/man-pages/man8/tc-netem.8.html), [Linux TCP-port classifier](https://man7.org/linux/man-pages/man8/tc-flower.8.html), [GitHub runner privileges](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

## Sustained eight-player check

`BASE_URL=http://127.0.0.1:3002 M1_EIGHT_SOAK=1 npx playwright test tests/e2e/eight-players.spec.ts` runs eight independent authenticated contexts for ten minutes against both local gateways. All four appearances are represented. It samples identities, presence, collision, frame times, garbage-collected heap and gateway CPU. Normal 240-second socket renewal must happen twice per member. Frame p95 must be ≤20 ms, server step CPU p95 <25 ms, and retained heap must stay within the documented bounded warm-cache allowance (30% plus 8 MiB relative to the first minute).

Results are pending; this document alone does not mark M1 complete.
