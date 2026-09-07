# M1 completion — 2026-09-06

**PASS within the recorded test envelope. M2 has not started.**

M1 provides a private Meadow for up to eight independently authenticated players, four distinct cosmetic characters, immediate local prediction, server-owned movement/collision, synchronized facing/walking/waves, and Redis-backed temporary session recovery. The game remains on the existing Vercel project and Redis service. There is no inventory, gathering, combat, crafting, taming, building or durable gameplay saving.

## Acceptance evidence

| Gate | Result and evidence |
| --- | --- |
| N0 — admission and shared world | PASS: eight independent contexts, matching positions/appearances, ninth rejected, full-room member resumes. Atomic contention permits exactly eight across gateways. [Capacity](M1_EIGHT_PLAYERS.md), [four-character local/hosted results](M1_CHARACTER_ART.md) |
| N1 — authority and validation | PASS: strict schemas reject forged authority fields, malformed facing, excess/replayed/conflicting input and invalid credentials; server time credits bound movement. 35 rule/integration tests passed on Linux in the final CI run. [Protocol contract](M1_RESPONSIVENESS.md), `tests/realtime*.test.ts`, `tests/capacity.test.ts`, `tests/network.test.ts` |
| N2 — reconnect and generation replacement | PASS: same identity and safe position survive reconnect; replaced generations cannot write. Eight members renewed twice during the ten-minute soak. [Soak](M1_FINAL_VALIDATION.md), [hosted character recovery](M1_CHARACTER_ART.md) |
| N3 — one effective owner | PASS: Redis lease/generation fencing, owner recovery and Redis pause tests; prior real process-crash checks; hosted protocol-2 renewal/deployment overlap; eight-player soak observed two owners with consistent epoch ownership. [Hosted lifecycle](M1_RESPONSIVENESS.md), [final validation](M1_FINAL_VALIDATION.md) |
| N4 — missing/stale projections | PASS: dropped full projections, malformed deltas and stale epochs are rejected; valid full state recovers. Actual TCP loss and outage converge without duplicate identities. [Browser fault coverage](../TESTING.md), [TCP validation](M1_FINAL_VALIDATION.md) |
| Vercel lifecycle | PASS: actual production renewal and deployment overlap across independent authenticated contexts; existing protection retained. The earlier 260-second protocol-2 run measured 59.95 Hz and maximum observed snapshot gap 320.4 ms. [Lifecycle evidence](M1_RESPONSIVENESS.md) |
| Real TCP fault matrix | PASS: independent Chromium contexts, receiver-ingress 150/300 ms nominal RTT with jitter and 1% packet loss, plus a five-second 100% outage. Actual kernel drops and retransmissions verified. [Final CI run](https://github.com/elishaterada/astraworld/actions/runs/34084139471) |
| Eight-player sustained load | PASS: 603.862 seconds, eight actual browser contexts, p95 frame interval 16.7 ms each, retained heap growth <0.6%, all identities/peers retained, two renewals each, collision-free and consistent ownership. [Measurements](evidence/m1-final-eight-soak.json) |
| Rendered gameplay | PASS: four appearances, movement/facing/waves, native fullscreen and fallback, collision/camera/focus, seed determinism and canvas lifetime. Real local and hosted screenshots inspected. [Art verification](M1_CHARACTER_ART.md), [final browser screenshot](evidence/m1-final-browser.png) |

## Final verification revision

The successful manually dispatched Linux workflow ran `42bcdfb` and passed TypeScript, all 35 tests, production build, real browser fault tests, TCP retransmission analysis and network/capture cleanup. It required no production credentials. Its application runtime is unchanged from the previously deployed character update; changes in this final work add test infrastructure, Linux browser configuration and documentation.

The clean run's 150 ms RTT / 1% loss phase had 48 kernel drops and p95 confirmed-wave latency **392.4 ms**, below 500 ms. The 300 ms phase had 24 additional drops and p95 **822.4 ms**. Both identities recovered **5080 ms** after restoring traffic following the five-second outage. The packet-header analysis found **71 retransmission rows**. Received application traffic averaged about **5.6–5.7 KiB/client/sec**, below 50 KiB/sec. No page exceptions. A preceding gameplay-valid run measured 452 ms normal-profile p95 and 6051 ms recovery, but its job failed at capture deletion; that failure and the earlier setup failure remain recorded rather than being hidden. [Full final validation](M1_FINAL_VALIDATION.md).

Local rendering performance was measured on Apple M4 Pro, macOS Darwin 25.6.0, Chromium 153.0.8010.12, eight 1280×800 contexts. Linux TCP testing used two 800×600 software-rendered Chromium contexts. These are separate tests, not a claim that eight players were tested under packet loss simultaneously.

## Reproduce

- Local game: launch Redis, both gateways and the frontend as described in [README](../../README.md).
- Rules and build: `npm run typecheck`, `npm test`, `npm run build`.
- Eight-player ten-minute soak: `BASE_URL=http://127.0.0.1:3002 M1_EIGHT_SOAK=1 npx playwright test tests/e2e/eight-players.spec.ts`, with default 240-second socket renewal.
- Real TCP faults: `gh workflow run m1-network.yml --ref main`. The workflow is manually triggered, uses a disposable Linux runner and uploads measurement artifacts. Do not run the privileged network script on a general-purpose host.

## Material limits and stop line

This is a session prototype: Redis loss may lose worlds, and browser credentials/invitations are temporary. Vercel authentication protection still restricts hosted access. At high delay, TCP retransmission/head-of-line blocking can visibly delay confirmation; the measured 300 ms runs reached 0.82–1.11 seconds. These finite runs are not worst-case latency guarantees or production-scale certification.

Safari/Firefox, broad device/network diversity, many simultaneous worlds, multi-region behavior, eight-player packet-loss testing, and hardware input-to-photon p95 remain unverified. Art is provisional and waves retain their existing cue. Durable state belongs to M6.

**Next eligible milestone: M2 gathering and inventory, only after a new explicit request. Stop here for this task.**
