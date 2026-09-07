# M1 eight-player expansion

**Current status: [M1 complete](M1_COMPLETION.md).** The dated results and then-pending checks below are historical; final TCP-loss and eight-player soak evidence supersedes their outstanding-gate notes. M2 has not started.


User requested: remove the two-player restriction and support up to eight. This changes M1 capacity only. Later gameplay milestones remain unstarted.

## Implementation

- `packages/protocol/capacity.ts` defines the active maximum of eight. Server admission, snapshot validation and both UI counters use it. Invitation instructions allow seven friends; a full room reports eight adventurers.
- Redis checks membership count and inserts the new member atomically, so concurrent joins through different gateways cannot exceed eight. Membership is reserved for session resume, even while disconnected; this is a member cap, not a replaceable spectator queue. The prior 30-minute session/invite lifetime behavior remains.
- Each admitted member receives a stable `spawnIndex` (0–7) in the same atomic operation. The authoritative runner places new actors two tiles apart on the starting path. Checkpoints retain positions across reconnects. No client can choose a spawn slot or authoritative position.
- Movement, facing, walk/idle state and wave projections include up to eight actors. Existing nearby filtering remains 48 tiles; the displayed count is nearby active players. Per-client input/rate/payload limits and server authority are preserved. Character looks can be reused; names and markers still distinguish players. Wave markers appear above names to keep group labels readable.
- New sessions use `meadow-session-v2-p8`, `local:astraworld-v2-p8`, `production:astraworld-m1v2-p8` and capacity-specific preview namespaces. Earlier clients with a strict two-actor schema stay isolated during deployment. Refresh, create a new Meadow and share its new invitation. Old invitations are not migrated. Protocol 1 remains a historical two-player compatibility path.

## Verification

Local checks passed: TypeScript, production build, **33/33 rule/integration/client tests**, and the dedicated eight-player browser scenario in Chromium 153.0.8010.12 (nine isolated contexts on two separate gateway processes). All eight moved roughly 2.6 tiles, every observer received seven peers and facing/waves, the ninth was refused, and a full-room member resumed. No browser errors. [Local evidence](evidence/m1-eight-local.json). Runtime `cb895ab` deployed through the existing Git/Vercel integration. The same nine-context scenario **passed on the protected production Vercel app** in 26.3 seconds, using real issued credentials: eight members each saw seven peers, all moved approximately 2.6 tiles, all facing/waves synchronized, the ninth was refused, and the eighth resumed its identity and position in the full room. No browser errors. [Hosted evidence](evidence/m1-eight-hosted.json), [hosted screenshot](evidence/m1-eight-hosted.png).

The first hosted run failed an immediate renderer-position assertion after reconnect. The test now independently checks the authoritative recovered position, then waits for the next rendered state: the recorded run observed network readiness at the correct x=81.1 while the renderer still reported its initial x=64.5, and both renderer/state checks converged within the next 105 ms polling observation. This was an asynchronous test-readiness issue, not lost server position; no runtime reconnect behavior was changed.

TypeScript passed again after the test correction. Production health reported ready for `cb895ab` in `iad1`; the 10-minute Vercel production error-log query returned no matching errors. The hosted run used one Vercel gateway instance; the local run exercised two separate gateway processes. Eight-player cross-deployment renewal was not rerun; preceding two-player handoff evidence remains separately labeled.

Tests added:

- Concurrent admission from two gateways: 20 competing joins claim exactly seven remaining slots; a ninth member is rejected; all eight credentials remain valid for resume. Spawn slots are unique and collision-free.
- Snapshot schema accepts eight actors and rejects nine.
- Nine independent browser contexts: eight enter and see seven peers, all eight move, turn and wave, a ninth is refused, and the eighth resumes without consuming a ninth slot. The local test alternates between two separate gateway processes.

The eight-player change does not close the existing M1 true TCP packet-loss gate. Eight-player ten-minute soak, many concurrent rooms, multi-region behavior and durable gameplay load remain unverified unless recorded here separately.
