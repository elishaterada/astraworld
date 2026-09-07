# Declarative content contract

## Boundaries

Versioned content files describe instances of supported mechanics. Simulation handlers implement mechanics. Content cannot execute arbitrary scripts, import server secrets or redefine authority rules. Schema and referential validation run at build/startup; invalid content fails clearly before a world loads.

Start with JSON or typed TypeScript data validated through a single schema layer; choose the format in M2 and document it. Do not introduce a CMS, mod loader or generic behavior language for the slice.

## Proposed definition shapes

| Kind | Required fields |
| --- | --- |
| Creature | id, schemaVersion, temperament, stats, habitatIds, abilityIds, optional tameRule, visualId |
| Item | id, schemaVersion, displayName, stackMax, tags, iconId |
| Resource | id, toolRequirement, gatherDuration, yields, collisionFootprint, visualId |
| Ability | id, handlerId, targetTags, range, timing, cooldown, effects allowed by handler |
| Biome | id, paletteRef, terrainSet, resourceSpawnRules, creatureSpawnRules |
| Recipe (M7) | id, inputs, output, optional stationId |
| Structure (M8) | id, footprint, allowedRotations, cost, collisionLayers, visualId |

## Example data sketch, not runtime code

```yaml
id: moss-slime
schemaVersion: 1
temperament: curious
habitatIds: [meadow]
stats: { health: 30, moveSpeed: 2.2 }
abilityIds: [dissolve-vines]
tameRule:
  handlerId: feed-count
  itemId: sweet-berry
  requiredFeeds: 3
visualId: moss-slime
```

`feed-count` and `dissolve-vines` must already exist as Astra-built handlers before this definition can load. Schema must reject unknown handlers, negative speeds, invalid counts, missing visual IDs, duplicate IDs and dangling references. Final values belong in one content source, not duplicated across UI and server.

## Version policy

Record `contentVersion` on each world. Definitions use stable IDs; rename display names freely but migrate removed or changed gameplay IDs. Changes that alter footprint, taming cost or progression require migration/compatibility review for saved worlds. Cosmetics can version independently if their IDs remain compatible.

## Luna expansion task template

Specify the reference definition, existing allowed handler IDs, number of new entries, exact allowed files, schema/reference checks, balance constraints and visual descriptions. Require no engine or protocol changes. If a concept needs a new ability handler, report that dependency and return the system work to Astra. Test that the added content loads in a representative world and does not violate progression reachability.

## M2 reference

`packages/content/index.ts` supplies typed TypeScript literals validated by strict Zod schemas at module initialization (including build/startup). Four items and two resource definitions use schema version 1. Closed item/resource/visual ID sets, positive bounded quantities, duplicate detection and referential checks reject invalid content. `gatherDuration` is 30 server ticks of recovery after an accepted harvest. M2 world content version is `gathering-1`; incompatible rooms use `p8-c4-m2`. No arbitrary handlers or scripts are supported.
