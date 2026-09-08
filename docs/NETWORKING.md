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


## M3 combat extension

`combat-1` / `p8-c4-m3` isolates the additional strict schemas from old rooms. Optional discrete attack/dodge flags use the existing sequenced frame runs: they appear only on the first frame of a run, cannot coalesce into other actions, and participate in conflicting-replay checks. Only the room owner resolves damage and AI at 60 Hz. Actor combat and the one Slime instance are immutable checkpoint fields and publish with the existing 10 Hz fenced snapshot. New connection generations retain committed health, cooldowns, hits, respawn state and defeat. The client predicts movement and gestures, replays outstanding input against confirmed state, and never predicts damage or rewards. The 150 ms RTT browser check delays WebSocket sends/callbacks; it is not a repeat of the historical TCP-loss gate.

## M4 companion extension

Isolated `taming-1 / p8-c4-m4` rooms add an optional strict `companion: {seq, target, action}` intent to frame batches; action is feed/follow/stay/recall. Only the authenticated player can act. A single pending client command retries until its private `companionReceipt` acknowledges the sequence; duplicates cannot consume food again. Full projections include the two public Moss instances (identity, position, facing, movement, owner, feeding claim/progress, mode and fed tick). Internal paths and cooldowns stay server-side. Inventory, receipt and ownership commit in one fenced room checkpoint; owner turnover and connection-generation replacement reuse this state. No client ownership or success fields are accepted. See [M4 evidence](milestones/M4_TAMING.md).

## M5 gate projection

The companion command action set adds `dissolve`; target must be the generated gate ID. A full `gate` projection carries tagged identity, open flag, opened tick and optional one-second channel. Owner generation and validated command sequence fence start/completion. Clients apply the confirmed open overlay before replaying pending movement; they never predict gate success. The existing fenced checkpoint retains gate state with inventory and companions, and late joiners receive the same full state. A generation-checked internal disconnect notification cancels observed socket closes; otherwise existing presence timeout bounds detection. See [M5's precise disconnect limit and tests](milestones/M5_COMPANION_UTILITY.md).

## M6 durable publication barrier

The 60 Hz pure simulation and client prediction are unchanged. Significant changes are journaled and committed as a versioned Postgres world aggregate before the 10 Hz snapshot publisher may expose them. Database failure pauses authoritative publication and reacquires/reloads the durable revision, including ambiguous commit outcomes; the client retains pending intents until a confirmed receipt. Duplicate/reused sequence numbers cannot grant another reward. Redis stores the durable revision beside its checkpoint; an older cache never overrides newer inventory/ownership/progression. Postgres owner tokens fence independently of Redis lease tokens. M6 uses `p8-c4-m6` namespaces and retains `meadow-3 / utility-1` generated content.

## M6 player QoL update

This update supersedes earlier cadence defaults: simulation stays at 60 Hz, client input flushes every 25 ms (up to 40 messages/second), and authoritative snapshots are scheduled every 50 ms (up to 20 Hz). Remote interpolation uses four ticks (~67 ms), with the existing 150 ms extrapolation cap. Idle heartbeat remains one second. Inbound message refill is 60/second with a 40-message burst; input frame credits still bound simulation time. Durable changes still wait for Postgres confirmation. These cadences are ceilings, not end-to-end latency guarantees, and increase traffic relative to the prior 50/100 ms configuration.

Protocol 2 / `p8-c4-m6` worlds remain compatible. New clients advertise optional `qol: true` in hello to receive an eight-member maximum online roster regardless of the 48-tile actor interest radius. Legacy clients receive the original snapshot shape. Run is movement bit 16 (key mask maximum 31), predicted and validated through the existing frame timeline. Large remote displacement snaps instead of interpolating a teleport across the world.

Teleport uses the existing sequenced companion command envelope with action `teleport` and a target member ID. The server resolves both actors, online status, combat restrictions, cooldown, collision and reachable terrain; no client coordinates are accepted. Successful position, private cooldown and receipt commit together through the M6 aggregate and command journal. See [Player QoL](milestones/PLAYER_QOL.md).

## M7 crafting protocol

Wire protocol **3** adds `stone`/`stone-axe` inventory values, `loose-stone` gathering visuals and optional shared `benches` snapshots. The existing gather command may include `action: "craft" | "place"`; `target` identifies a recipe or one of two fixed plots. No arbitrary coordinates or outputs are accepted. Existing sequence acknowledgement, retry, membership and Postgres publication barriers apply to the whole transition. Input and snapshot cadences are unchanged from QoL.

Saved-world metadata, generation IDs and durable namespaces remain unchanged. M6 JSONB states default to no benches, preserving inventory and identity. New loose-stone nodes append to the resource order; old depleted IDs remain valid. Wire-version mismatch requires a client refresh. This change is locally verified only: a future production rollout must coordinate all gateways/clients and avoid simultaneous M6/M7 room owners; hosted lifecycle verification is still required.

## Creature population protocol

The post-M7 population expansion adds six authoritative hostile encounters and eight pets. Wire protocol 4 carries the original `slime`, up to five additional `monsters`, and up to eight `moss` instances. All player strikes resolve before enemy impacts, with at most six distinct hit IDs per swing. Existing saved-world IDs remain unchanged; deployment requires coordinated gateway/client updates. See [decisions and evidence](milestones/MEADOW_CREATURES.md).

The subsequent [combat-rhythm upgrade](milestones/COMBAT_RHYTHM.md) advances the wire version to 5. Combo stage and interruption state remain server-owned; held input uses the existing rate-limited frame stream. Saved namespaces remain unchanged.

## Post-M7 combat arsenal

The user-authorized [combat arsenal](milestones/COMBAT_ARSENAL.md) adds charge, frontal guard/parry, five training loadouts and one skill per class. Wire protocol **6** carries their intent and authoritative state. Friendly fire defaults off and is a durable world rule controlled only by the authenticated creator. This supersedes earlier player-immunity and melee-only scope for this increment; pets remain immune. Existing saves load additively without changing world IDs or namespaces. See the decision record for timings, controls, permission boundaries and verification.
