# Realtime multiplayer and networking

## Authority and provisional budgets

Clients submit intents. The server owns position, velocity bounds, collision, health, cooldowns, loot, inventories, creature ownership and world edits. Clients own input collection, camera, animation, sound and visual prediction.

Start with a 20 Hz fixed simulation tick, up to 20 input messages/second/client, 10 Hz state snapshots and a 60 FPS render target. Use two players through M5 and test four at M6. These are engineering defaults to measure, not platform guarantees. Prefer readable JSON schemas first; binary packing waits for measured need.

## Protocol sketch

Every message has `protocolVersion`, `type`, `worldId` and a session-bound identity established at authentication. Never accept a payload actor ID as authorization. Server messages include `epoch`, `serverTick` and monotonically increasing `snapshotSeq` or `eventId`.

| Direction / type | Fields and semantics |
| --- | --- |
| Client hello | Connection credential, protocol version, content version, optional resume token |
| Server welcome | Authorized character ID, world seed/gen version, epoch, tick and full initial projection |
| Client input | Session generation, increasing input sequence, movement vector, aim; no position or damage |
| Client action | Unique command ID, action kind, target ID, expected target revision where relevant |
| Server snapshot | Full/delta marker, base snapshot sequence, acknowledged input sequence, changed entities and removals |
| Server action result | Command ID, success/rejection code, authoritative result/revisions |
| Server resync | New epoch/version or required full-snapshot reason |
| Heartbeat | Liveness and measured RTT; not proof of gameplay authority |

Input is latest-state movement, not a request to simulate an arbitrary duration. Server advances exactly one fixed dt per tick, clamps vector length, bounds aim values and times out input after a proposed 250 ms without an update. Releasing keys sends zero input. Action IDs persist across retry; input sequence is scoped to the session generation.

Validate payload size (initial cap 8 KiB), schema, finite numbers, enum values, membership, rate and action prerequisites before entering simulation. Initial limiter: 30 input messages/second with a short burst allowance and 10 action requests/second; action-specific cooldowns remain authoritative. Reject oversized or malformed traffic without crashing a room.

## Prediction and snapshots

Predict only local movement with the same collision function as the server. Keep a bounded input history. On snapshot, reset to authoritative position, discard acknowledged inputs and replay remaining inputs against the latest collision state. Smooth small visual corrections; snap large invalid displacements. Damage, loot and taming may show pending feedback but cannot be committed optimistically.

Interpolate remote actors with an initial 100 ms buffer; bound extrapolation to 100 ms, then hold and show connection trouble. Tune from measured jitter. Full snapshots initialize/recover state. Apply deltas only against their specified base; a missing base, epoch change or version mismatch triggers a full resync. Discard stale sequences. Removal tombstones prevent ghosts.

Subscribe clients to camera-near chunks plus a margin, but compute interest server-side from authoritative position. Include relevant attacking actors/companions across edges. Do not broadcast private inventories or unseen distant actor positions. On interest exit send removals; on entry send full entity state.

## Exactly one room owner

A socket gateway forwards to the authoritative owner; it does not simulate its connected players separately. Prototype a per-world renewable Redis lease with an epoch and expiry (initial proposal: 10-second lease, renewal every 3 seconds). All hot state publication/checkpoint writes must atomically verify the current lease token/epoch. A stale owner must be unable to write, even if its local timer wakes after a pause.

Route actions through a bounded Redis stream or equivalent acknowledged queue; owner consumes in stable order and deduplicates command IDs. Movement may use replaceable latest-input state. Pub/sub can fan out ephemeral snapshots but cannot be the only record of valuable actions. Lost snapshot fanout is repaired by resync, not blind assumptions about reliable pub/sub.

Through M5, hot command results and significant session mutations are atomically recorded in Redis before a success response. An owner resumes from a consistent checkpoint and replay position. Movement may roll back to a recent checkpoint on owner loss; consumed berries and accepted tame results must not duplicate during supported session recovery.

From M6, Postgres is also the durable fencing authority: the new owner obtains an increasing epoch in a serialized ownership transaction, and every durable mutation locks/checks that world's current epoch in its transaction. Redis ownership is not sufficient to fence a stale Postgres writer. A Redis loss triggers reacquisition through Postgres before accepting actions; never reuse an old epoch. If any fencing check fails, the old runner stops writes and disconnects/resyncs clients.

## Disconnects and process lifecycle

1. Detect stale connection, zero its input, remove it from active targeting after a short grace period and retain its session identity.
2. Reconnect with exponential backoff plus jitter (initial 0.5 s, capped at 10 s); refresh expired credentials through HTTPS.
3. Authenticate membership and resume identity; replace the old connection generation so two tabs cannot control one character concurrently.
4. Send a full snapshot, new epoch/session generation and acknowledged command outcomes; clear obsolete prediction history.
5. Retries reuse their command IDs. Unknown outcomes query/resubmit through the deduplicating authority.

On planned owner rotation: stop accepting new actions briefly, checkpoint, release/handoff ownership, let the next owner acquire a new epoch, and resync. On crash, wait for lease expiry, recover and reacquire. Do not promise seamless zero-loss movement under process termination. Measure recovery and communicate reconnecting state.

M1 must prove this lifecycle across instances and runtime expiration on the chosen host. Vercel hosting constraints and fallback are documented in [ARCHITECTURE.md](ARCHITECTURE.md). Do not simulate offline time after a long outage: resume at a safe state; offline production is deferred.

## Mandatory failure cases

Two players gather the last node; two players feed the same Slime; duplicate/reordered action commands; stale input floods; client teleport claims; background tab resumes; epoch changes mid-attack; lost delta base; owner dies after commit before reply; old owner returns after failover; Redis unavailable; disconnect during vine activation. Expected outcomes are in [TESTING.md](TESTING.md) and [PERSISTENCE.md](PERSISTENCE.md).
