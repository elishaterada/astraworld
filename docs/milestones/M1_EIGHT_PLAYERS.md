# M1 eight-player expansion

User requested: remove the two-player restriction and support up to eight. This changes M1 capacity only. Later gameplay milestones remain unstarted.

## Implementation

- `packages/protocol/capacity.ts` defines the active maximum of eight. Server admission, snapshot validation and both UI counters use it. Invitation instructions allow seven friends; a full room reports eight adventurers.
- Redis checks membership count and inserts the new member atomically, so concurrent joins through different gateways cannot exceed eight. Membership is reserved for session resume, even while disconnected; this is a member cap, not a replaceable spectator queue. The prior 30-minute session/invite lifetime behavior remains.
- Each admitted member receives a stable `spawnIndex` (0–7) in the same atomic operation. The authoritative runner places new actors two tiles apart on the starting path. Checkpoints retain positions across reconnects. No client can choose a spawn slot or authoritative position.
- Movement, facing, walk/idle state and wave projections include up to eight actors. Existing nearby filtering remains 48 tiles; the displayed count is nearby active players. Per-client input/rate/payload limits and server authority are preserved. Character looks can be reused; names and markers still distinguish players.
- New sessions use `meadow-session-v2-p8`, `local:astraworld-v2-p8`, `production:astraworld-m1v2-p8` and capacity-specific preview namespaces. Earlier clients with a strict two-actor schema stay isolated during deployment. Refresh, create a new Meadow and share its new invitation. Old invitations are not migrated. Protocol 1 remains a historical two-player compatibility path.

## Verification

Local checks passed: TypeScript, production build, **33/33 rule/integration/client tests**, and the dedicated eight-player browser scenario in Chromium 153.0.8010.12 (nine isolated contexts on two separate gateway processes). All eight moved roughly 2.6 tiles, every observer received seven peers and facing/waves, the ninth was refused, and a full-room member resumed. No browser errors. [Local evidence](evidence/m1-eight-local.json). Hosted verification is pending deployment.

Tests added:

- Concurrent admission from two gateways: 20 competing joins claim exactly seven remaining slots; a ninth member is rejected; all eight credentials remain valid for resume. Spawn slots are unique and collision-free.
- Snapshot schema accepts eight actors and rejects nine.
- Nine independent browser contexts: eight enter and see seven peers, all eight move, turn and wave, a ninth is refused, and the eighth resumes without consuming a ninth slot. The local test alternates between two separate gateway processes.

The eight-player change does not close the existing M1 true TCP packet-loss gate. Eight-player ten-minute soak, many concurrent rooms, multi-region behavior and durable gameplay load remain unverified unless recorded here separately.
