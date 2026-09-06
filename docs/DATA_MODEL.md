# Proposed persistence data model

This is a logical schema for M6 and later, not executable migrations. Use server-issued identifiers, UTC timestamps for persistence, integer quantities, explicit revisions and foreign keys. Tick-based cooldowns need a restart policy rather than assuming a tick index is a permanent timestamp.

## Durable tables

| Record | Key / significant fields | Constraints |
| --- | --- | --- |
| users | id, identityProviderSubject, createdAt | Unique provider subject; no credentials in game state |
| worlds | id, seed, generationVersion, contentVersion, status, ownerEpoch | Pinned versions, monotonically increasing epoch |
| world_members | worldId, userId, role | Unique membership, authorized role |
| characters | id, worldId, userId, safeX, safeY, health, revision | One character per user/world initially |
| inventories | id, characterId, revision | One inventory per character initially |
| inventory_slots | inventoryId, slotIndex, definitionId, quantity | Unique slot, positive bounded quantity, valid definition |
| equipment | characterId, slot, itemDefinitionId | One item per equipment slot; grants recorded once |
| creature_instances | id, worldId, definitionId, originSpawnId, ownerCharacterId, state, safePosition, revision | Unique origin per world; ownership transitions atomic |
| active_companions | characterId, creatureId | One active per character; unique creature; same world and owner |
| taming_progress | creatureId, feedingCharacterId, acceptedFeeds, claimExpiresAt, revision | One claim per creature, feed count 0–3 |
| chunk_modifications | worldId, chunkX, chunkY, objectId, kind, payload, revision | Unique object modification; tombstones suppress baseline |
| world_progression | worldId, flagId, value, revision | Unique flag; vine gate open is monotonic in slice |
| commands | worldId, actorId, commandId, requestHash, result, committedAt | Unique deduplication key; immutable result |
| outbox | eventId, worldId, aggregateId, revision, type, payload, publishedAt | Inserted with mutation; replay-safe consumers |
| structures (M8) | id, worldId, ownerCharacterId, definitionId, tileX, tileY, rotation, revision | Valid footprint and placement checks |
| occupied_cells (M8) | worldId, tileX, tileY, layer, structureId | Unique occupied cell per collision layer |
| containers / container_slots (M8) | id/slot keys, structureId, itemDefinitionId, quantity, revision | Transfer atomically with player inventory |

Definitions for items, creatures, abilities and recipes live in versioned content files first, not editable database rows. Runtime validation must resolve their IDs against the world's pinned content version. Database foreign keys can reference a content-version registry if needed, but do not build a CMS for the slice.

## Transaction invariants

- Inventory counts never go negative or exceed stack/capacity rules.
- Taming has one owner and preserves creature identity. Same-world relationships are enforced transactionally or with composite keys, not trusted from the client.
- Final feed cost, ownership and active selection commit together; reject the final feed if the player already has an active companion in the slice.
- Resource depletion and reward are one mutation. Gate collision removal and progression flag are one mutation.
- Crafting/placement consumes materials only if output/footprint constraints also succeed.
- Every durable command checks the current world's owner epoch inside the transaction; a lease check made earlier is insufficient.

## Hot Redis key sketch

Namespace all keys with environment and schema version. Example suffixes: `world:{id}:lease`, `world:{id}:route`, `world:{id}:checkpoint`, `world:{id}:inputs`, `world:{id}:commands`, `world:{id}:results`, `world:{id}:snapshots`, `session:{id}:presence`. Choose key tagging/hash-slot strategy when selecting Redis deployment; scripts must atomically access the keys they depend on.

Lease records have TTLs; checkpoints and dedupe results share the documented session retention policy through M5. From M6 Redis is rebuildable and durable command results remain in Postgres for at least the permitted retry lifetime. Do not prune a dedupe key while a credential can still validly replay it; default to retaining records through the prototype and design bounded retention before scale.

## Versions and migrations

Version protocol envelopes, content schemas, generator algorithms, persistence schema and hot checkpoints separately. Reject unsupported versions clearly. Migration tests must load an old fixture and preserve owned creatures, inventories, gate state and origin-spawn suppression. Backups and rollback strategy precede destructive migration execution.
