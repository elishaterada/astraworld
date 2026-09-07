# Persistence and recovery

## Milestone contract

M0 is local and ephemeral. M1–M5 support session recovery using Redis hot state, with a proposed 30-minute empty-room TTL. No claim of permanent saving before M6. M6 introduces Postgres durable records and must survive loss of both runner memory and Redis data for acknowledged significant changes.

Redis is the hot/distributed layer, not the sole durable truth. Postgres stores durable player consequences. In-memory state is only the active simulation working copy, always protected by owner fencing. See [DATA_MODEL.md](DATA_MODEL.md) for records.

## State placement

| State | Hot representation | Durable behavior from M6 |
| --- | --- | --- |
| Presence, connection routes, latest input | Redis TTL records | Not durable |
| Wild movement and attack animations | Owner state, Redis checkpoint | Reconstruct safely; no per-tick DB writes |
| Character safe position/health | Owner state and checkpoint | Periodic bounded save; may resume at safe spawn after abrupt loss |
| Inventory/equipment | Owner projection plus Redis cache | Transactional committed records |
| Creature ownership/status | Owner projection plus Redis cache | Commit taming and active companion selection |
| Depleted resources and opened gates | Hot world modifications | Commit with associated reward/cost |
| Seed and generator/content versions | Redis cache | Durable world metadata |
| Structures and container contents | Later hot projection | M8 transactional placement/transfer |

## Command transaction pattern

For gathering, feeding, taming, utility unlocks and later crafting/building:

1. Validate identity, current owner epoch and gameplay prerequisites. Reserve affected entities in the room so conflicting actions cannot pass while I/O is pending.
2. Begin a Postgres transaction. Lock/check world epoch, then affected records in a stable lock order. Revalidate expected revisions, ownership, inventory and cost against durable state.
3. Look up `(worldId, actorId, commandId)`. A completed command returns its stored result without applying again. Reusing an ID with a different payload is rejected via stored request hash.
4. Apply costs and consequences together: decrement berries plus progress/ownership; deplete node plus award wood; remove gate plus progression flag. Enforce database constraints.
5. Insert command result and outbox event in the same transaction. Commit.
6. Apply the committed event to the hot projection idempotently by revision/event ID, then acknowledge success. Publish to clients through the outbox relay; retries do not repeat consequences.

Do not independently write Redis and Postgres and assume they committed together. A periodic snapshot alone is insufficient for ownership or inventory integrity. Pending UI feedback is allowed; final success awaits the durable commit.

## Failure outcomes

| Failure point | Required result |
| --- | --- |
| Before transaction commit | No success acknowledgment; retry can apply once |
| After commit, before client reply | Retry returns the recorded result; no second cost/reward |
| After commit, before Redis update | Outbox/reload repairs projection from Postgres |
| Duplicate outbox delivery | Ignore an already applied event/revision |
| Database unavailable | Reject/pause valuable mutations with retryable feedback; no false saved indicator |
| Redis unavailable | Pause room mutations and recover ownership safely; do not fork in-memory authorities |
| Old owner writes after failover | Durable epoch check rejects its transaction |
| Hot checkpoint older than durable state | Overlay newer durable records before allowing input |

## Loading and saving

Load world seed and pinned versions → establish owner epoch → generate baseline chunks → apply durable modifications/tombstones → restore characters and companions → apply valid newer hot movement checkpoint → send full snapshot. Durable revision wins over hot data for inventory and progression.

Save safe character location periodically (initial 5-second target) and on graceful leave; after unexpected loss permit at most that positional rollback under normal operation, or safe-spawn fallback if the checkpoint is invalid. Significant acknowledged changes have a zero-loss application-level target on runner/Redis failure, subject to the configured database durability. Whole-database disaster recovery depends on provider backup/PITR capabilities and must be configured and tested before public release.

World modifications store deltas over generation, not millions of unchanged tiles. Content/generator version remains pinned per world. Upgrade existing worlds through explicit migrations, never regenerate silently with a new seed algorithm.

## Operations gate

Before M6 acceptance: run migrations on a disposable database, test restore into an isolated environment, simulate process/Redis loss, verify owner fencing and report backup retention/recovery expectations for the selected provider. Do not create paid services during documentation. M6 chooses provider, pooling, migration tool and identity binding based on actual deployment constraints.

## M1 local hot-state reference

The implemented Redis adapter stores room metadata, a two-entry membership hash, a generation hash, latest-input/presence hash, fenced checkpoint, lease and monotonic epoch. Gateway routing uses per-room pub/sub channels; gateways deliver only authorized nearby projections. Checkpoints contain positions and acknowledgements, never credentials. Credential hashes live separately in membership.

Active checkpoints/membership are refreshed to 1,800 seconds on successful fenced commits. Empty runners stop after a short grace; recovery expires about 30 minutes later. Invite lookup expires 30 minutes after creation. Epoch counters intentionally survive room TTL so an ID's epoch is never reused; production cleanup for permanently expired room IDs is not implemented. The finite local test workload is not a public capacity claim.

Local Redis is launched without disk persistence. A Redis restart can lose all sessions, and explicit Leave discards that tab's credential. There is no Postgres schema or permanent-save claim. See [the local evidence](milestones/M1_LOCAL_RESULTS.md) for process death, stale-owner rejection and Redis-unavailability results.
