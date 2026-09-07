# M1 implementation contract

**Current status: [M1 complete](M1_COMPLETION.md).** The dated results and then-pending checks below are historical; final TCP-loss and eight-player soak evidence supersedes their outstanding-gate notes. M2 has not started.


Authorized by “Great, next step” following M0. Work is limited to M1; the deployed-host gate remains mandatory.

## Reference choices

- Keep the existing Next/Pixi frontend and pure movement. A Node HTTP/WebSocket gateway also hosts bounded room-runner candidates. Each occupied gateway can attempt ownership; Redis chooses exactly one effective writer.
- Use strict versioned JSON, 8 KiB inbound frames, latest movement intent at 20 Hz, server simulation at 20 Hz and full snapshots at 10 Hz. Full-only snapshots deliberately remove delta-base complexity for two players; invalid delta messages request full resync, while old epochs/ticks are discarded.
- Server issues random player IDs and 256-bit bearer resume credentials, stores only credential hashes in Redis, and binds each to one room. A random invite admits exactly one additional member atomically. No account or durable identity product. The browser keeps its resume credential in tab session storage; invite codes are shareable access capabilities.
- Redis keys use an explicit environment prefix and room hash tag. A 10-second lease with a monotonic epoch is renewed every 3 seconds. Every checkpoint and snapshot publication is a single Lua transaction checking the exact lease token. Losing Redis or fencing pauses publication; no uncommitted state reaches clients. A checkpoint on every 50 ms step bounds ordinary position rollback and simplifies the first reference.
- Connections increment a per-character generation atomically. Latest intent and presence are generation checked; replaced sockets cannot control a character. No input for 250 ms means zero movement; no presence for 3 seconds removes the actor from visible projections while membership and safe position remain for the session.
- Client prediction uses the shared collision rules and bounded unacknowledged inputs. Server snapshots reconcile; remotes interpolate approximately 100 ms behind. Disconnects freeze prediction, reconnect with bounded backoff to alternate gateways, and require a fresh full snapshot.
- M1 players collide with terrain, not each other. Near-player projection radius is 48 tiles; remote disappearance is implicit in each full projection. Empty rooms and membership expire after 30 minutes. Redis loss can lose the session; there is no permanent saving.

## Acceptance work

Rules/schema tests; real Redis lease contention, stale-writer fencing and generation replacement; two processes and independent browser contexts; reconnect to another gateway; forced owner rotation/crash; malformed and forged traffic; clean and degraded network. Preserve M0 geometry/art and rerun relevant regressions.

Current Vercel documentation (checked 2026-09-06) supports Node HTTP/ws servers in beta, pins a connection to an instance and ends it at the function duration. This local reference does not prove occupied-runner lifetime on that platform. No cloud resources will be created without a selected existing test environment and authorization. Record actual host access and remaining gate in the evidence report.
