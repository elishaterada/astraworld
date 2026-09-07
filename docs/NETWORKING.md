# Realtime multiplayer and networking

**Current M1 implementation:** [protocol 2 responsiveness contract](milestones/M1_RESPONSIVENESS.md). It supersedes the earlier 20 Hz prediction / per-tick Redis / 45-second rotation reference. Broader future-system proposals below remain outside M1.

## Authority and provisional budgets

Clients submit intents. The server owns position, velocity bounds, collision, health, cooldowns, loot, inventories, creature ownership and world edits. Clients own input collection, camera, animation, sound and visual prediction.

Start with a 20 Hz fixed simulation tick, up to 20 input messages/second/client, 10 Hz state snapshots and a 60 FPS render target. The current user-authorized capacity is eight players; M6 must revalidate that capacity with durable gameplay state. These are engineering defaults to measure, not platform guarantees. Prefer readable JSON schemas first; binary packing waits for measured need.

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

## Implemented M1 local wire reference (2026-09-06)

The [local result](milestones/M1_LOCAL_RESULTS.md) records what has been verified. The current implementation uses the following smaller concrete subset of the proposed protocol above:

- `POST /session {name, invite?, character?}` on an allowed-origin gateway creates a private room or claims its second membership. It returns server-issued world/player IDs, seed, name, a random bearer resume token and an invite capability. Only token hashes are stored server-side. No browser-supplied player ID is accepted as identity; `character` is only a validated cosmetic definition ID.
- `/play` upgrades to WebSocket. First frame is `hello {protocolVersion:1, worldId, token, contentVersion, generationVersion, characters?:true}`. Success sends `connected {protocolVersion:1, worldId, generation}`; the client must then await a full snapshot before predicting movement.
- `input {protocolVersion:1, worldId, generation, seq, movement:{x,y}}` is the only movement message. Extra fields are invalid. Sequence is monotonic within a connection generation; there is no client tick duration, position, aim or gameplay action in M1.
- `snapshot {protocolVersion:1, type:"snapshot", full:true, worldId, seed, contentVersion, generationVersion, epoch, tick, owner, selfId, actors}`. Each actor has `id`, `name`, `position`, `generation`, `ack`; opted-in clients also receive `character`. Full projections are 10 Hz; omission removes a remote actor. The gateway filters actors more than 48 tiles from the authoritative local player. A player's own projection is always included while their presence is active.
- `resync {protocolVersion:1, worldId}` asks for the next full projection. No deltas are emitted. Invalid delta messages trigger resync; old epochs/ticks are dropped without changing state. A new connection resets its snapshot baseline, even if it returns to the same epoch.

Pure `step` remains shared with prediction. The local runner writes a checkpoint every tick and atomically publishes every other tick only if its exact Redis lease token still matches. This deliberately favors a simple, measurable two-player reference over reducing Redis operations prematurely. The active state advances only after the fenced write succeeds. Runtime adapters use clocks and random credentials; simulation does not.

Connections share a generation stored in Redis. Replacement invalidates the old connection's writes and closes it with terminal code 4001. Expired credentials close with 4003. Transient transport/backend closure retries alternate configured gateways with bounded backoff. There are no short-lived signed access-token refresh endpoints yet; the opaque resume capability is valid only while its Redis membership exists. This provisional policy must be revisited with deployed-host access and later stable identity.

The hosted follow-up accepts the same validated sockets through Next.js/Vercel, coalesces one pending latest intent during Redis I/O, and reads room state atomically. An authenticated client waits up to 15 seconds for owner recovery before closing a silent socket; an incomplete handshake retains the three-second watchdog. The `connected` response includes a gateway diagnostic ID, exposed only in debug measurements. See [deployed results](milestones/M1_DEPLOYMENT.md) for measured overlap and expiry recovery.


### Cosmetic membership extension

Session admission validates `character` against `fern | ember | iris` (omission defaults to fern), stores it with immutable membership metadata, and returns it in the session. It cannot be changed by movement messages. Old membership records and snapshots without a character use fern. Character selection never affects physics, identity, permissions or awards.

The optional `characters:true` hello capability opts into the additive actor field. Redis snapshot fanout and checkpoints retain the original actor shape, protecting strict clients connected to gateways from the preceding deployment. New gateways enrich opted-in projections from membership metadata, cached for at most the room's two players and cleared with the room. A new member triggers one coalesced metadata read. Failed reads skip publication until recovery; no unvalidated appearance is invented. Clients without the capability receive the original strict schema. This cosmetic metadata is independent of the fenced movement checkpoint.

A new client pointed explicitly at an old gateway cannot use the new hello capability or admission field; update the configured gateways together. Hosted pages and same-origin endpoints switch with their deployment. This extension requires no new service or durable schema migration.

## Responsiveness review

The user requested immediate client-side response with bounded synchronization traffic. The [2026-09-06 responsiveness research](research/MULTIPLAYER_RESPONSIVENESS.md) distinguishes verified game-developer sources from inference and proposes an M1 revision. It identifies prediction/send-clock coupling, acknowledgement semantics, correction smoothing, Redis waits and routine hosted handoffs as investigation targets. Its proposed targets and architecture changes are not yet implemented or accepted performance results. The previous recovery pass must not be treated as proof of smooth ordinary play.

## Four-character membership compatibility

The cosmetic enum now accepts `fern`, `ember`, `iris`, and `hazel`. Appearance is chosen only at membership admission; snapshots and recovery retain that server-stored choice. New clients and Vercel/local gateways use `ROOM_REVISION=p8-c4` for Redis namespaces and tab session storage. This isolates older three-character strict validators during deployment overlap. Old temporary rooms/invitations are not migrated; refresh and create a new Meadow. Capacity remains eight, with no new movement or action messages.
