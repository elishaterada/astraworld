# M1 final validation

Scope: finish the existing eight-player, four-character M1 sandbox. No M2 work. Earlier hosted lifecycle/rolling-deployment, authority, generation fencing, admission, collision, and character checks remain in their original evidence files. This note records the final network and sustained-load checks without relabeling historical runs.

## True TCP fault harness

`.github/workflows/m1-network.yml` is manually dispatched on the public repository's standard Ubuntu runner. It uses disposable local Redis, two gateways, the production Next frontend and independent Chromium contexts. It does not use production credentials or provision a game host. This avoids changing this Mac's network configuration, where noninteractive administrator access is unavailable.

`scripts/netem.sh` requires an explicit test flag and Linux. It redirects only loopback TCP traffic with game gateway source/destination ports 3103/3104 from receiver ingress through a dedicated IFB device. Frontend assets, Redis, GitHub control traffic and other ports remain unaffected. Both directions receive 75±15 ms uniform delay (150±30 ms nominal RTT) and independently sampled 1% packet loss; a second phase uses 150±15 ms per direction, then a five-second 100% loss phase. Queue counters and packet-header-only retransmission fields establish the fault actually happened. No WebSocket message interception/substitution is used. Raw captures are temporary and never uploaded; only selected TCP header fields and aggregate measurements are retained. Cleanup runs on success or failure.

Browser checks cover immediate local prediction, accepted wave acknowledgements, matching remote action sequence/facing/position, collisions, bandwidth and identity recovery. The normal profile requires p95 confirmed wave latency below 500 ms; outage recovery must be under 15 seconds. Browser movement timing is an automated observation, not an input-device-to-photon benchmark. Actual delay/loss samples are stochastic; nominal configuration is not an assertion that every RTT equals 150 ms.

Sources: [Linux netem options and receiver-ingress guidance](https://man7.org/linux/man-pages/man8/tc-netem.8.html), [Linux TCP-port classifier](https://man7.org/linux/man-pages/man8/tc-flower.8.html), [GitHub runner privileges](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

## Sustained eight-player check

`BASE_URL=http://127.0.0.1:3002 M1_EIGHT_SOAK=1 npx playwright test tests/e2e/eight-players.spec.ts` runs eight independent authenticated contexts for ten minutes against both local gateways. All four appearances are represented. It samples identities, presence, collision, frame times, garbage-collected heap and gateway CPU. Normal 240-second socket renewal must happen twice per member. Frame p95 must be ≤20 ms, server step CPU p95 <25 ms, and retained heap must stay within the documented bounded warm-cache allowance (30% plus 8 MiB relative to the first minute).

## Observed eight-player result — PASS

The run lasted 603.862 seconds on Apple M4 Pro / macOS Darwin 25.6.0, Chromium 153.0.8010.12, eight 1280×800 viewports. Every client recorded p95 frame interval 16.7 ms (about 60 FPS). Both gateway step CPU p95 values were below 0.041 ms. Retained heap grew 0.26–0.54% from the first-minute post-GC samples to the end. All members renewed generation 1 → 3, retained their identities and seven peers, and stayed collision-free. The sampled room advanced at 59.98 Hz, observed two owner epochs (`local-a` then `local-b`), and never associated the same epoch with different owners. Largest five-second-sampled snapshot age was 108.8 ms; that sampling does not establish a worst-case gap. [Full soak measurements](evidence/m1-final-eight-soak.json).

## TCP test attempts

The first CI attempt, [34083296162](https://github.com/elishaterada/astraworld/actions/runs/34083296162), passed build/35 tests and its clean browser baseline, then stopped before the loss phase because Ubuntu's `tc` tried to load a nonexistent `uniform.dist`. The script now omits the distribution argument, selecting netem's default uniform jitter. [Failed-attempt evidence](evidence/m1-final-tcp-first.json) is retained and does not count as a packet-loss pass. Browser contexts use 800×600 on the software-rendered Linux runner; local hardware frame performance is measured separately above. Confirmed-action timing is observed inside the browser between the actual keydown event and the corresponding accepted server action, without test-driver polling delay.

## Observed TCP gameplay result — PASS (preceding run)

[Run 34083758058](https://github.com/elishaterada/astraworld/actions/runs/34083758058), revision `c33bc26`, passed all browser assertions and retransmission checks. The workflow then failed deleting the root-owned capture from `/tmp`; the deletion now uses the same privilege as capture creation. The raw capture was never uploaded, and runner network cleanup succeeded. This is a cleanup defect, not a failed gameplay assertion; the clean-workflow rerun passed as recorded below.

- Clean: eight confirmed waves, p95 248.4 ms. Nominal 150 ms RTT ±30 ms / 1% loss: 30 confirmed waves, p95 **452.0 ms**, max 525.9 ms; 45 real drops. Nominal 300 ms RTT / 1% loss: 12 confirmed waves, p95/max **1111.5 ms**, 25 additional drops. The degraded profile requires correctness and reconnect feedback rather than the normal latency target.
- Five-second 100% packet outage: prediction froze and reconnect feedback appeared; both original identities and peers recovered in **6051 ms** after restoring traffic, under 15 seconds. Facing, exact remote wave sequence, and final positions converged; no collision violations or page exceptions.
- Received application traffic averaged **5.5–5.7 KiB/client/sec**, under 50 KiB/sec. Sender traffic stayed bounded. Capture analysis identified **69 TCP retransmission rows**; the Linux TCP retransmission counter increased **1 → 78**. These independently support actual transport loss rather than application-message dropping.
- Linux software-rendered browser movement observations (including driver overhead) had p95 134 ms at normal impairment versus 159 ms clean. These are not hardware input-to-photon latency claims; the local hardware soak covers rendering cadence separately.

Evidence: [browser measurements](evidence/m1-final-tcp-verified.json), [TCP retransmission headers](evidence/m1-final-tcp-retransmissions.tsv), [queue counters](evidence/m1-final-tcp-qdisc.json), [recovered gameplay](evidence/m1-final-tcp-recovered.png).

## Clean end-to-end workflow — PASS

[Run 34084139471](https://github.com/elishaterada/astraworld/actions/runs/34084139471) on `42bcdfb` passed every step, including all 35 tests, TypeScript, production build, browser gameplay, nonempty retransmission analysis and capture/network cleanup. No gameplay runtime code changed between the two successful browser runs.

The final run measured: clean p95 confirmed wave 210.8 ms (8 samples); 150 ms nominal RTT / 1% loss p95 **392.4 ms**, max 457.8 ms (30 samples, 48 kernel drops); 300 ms nominal RTT / 1% loss p95/max **822.4 ms** (12 samples, 24 further drops). Five-second-outage recovery took **5080 ms** with both identities and peers intact. Received traffic averaged 5845/5691 bytes per client per second; no page exceptions. Header analysis found **71 retransmission rows**. These are measured finite-run samples, not maximum-latency guarantees.

Final evidence: [measurements](evidence/m1-final-tcp-clean-run.json), [TCP header rows](evidence/m1-final-tcp-clean-retransmissions.tsv), [queue counters](evidence/m1-final-tcp-clean-qdisc.json), [recovered screenshot](evidence/m1-final-tcp-clean-recovered.png). The final screenshot was visually inspected. [M1 completion](M1_COMPLETION.md) maps these checks to the overall acceptance matrix and preserves the remaining limitations.
