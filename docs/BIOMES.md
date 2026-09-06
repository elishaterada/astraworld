# Biomes and progression graph

## Scope by biome

| Biome | Fantasy and visual cues | Gameplay resources/creatures | Delivery boundary |
| --- | --- | --- | --- |
| Meadow | Open warm grass, scattered trees, generous sightlines | Sweet Berries, wood, hostile Slime and curious Moss Slime | Full slice activity area |
| Forest entry | Cooler greens, taller canopy, denser framing | Vine gate exit and discovery clearing | M5 destination only |
| Forest expanded | Ancient woodland, narrow paths and ruins | Proposed ore/rare plants, new creatures, Forest Guardian | M9, scope separately |
| Marsh | Muted wet ground, mushrooms and visible hazards | Proposed poison-resistant companion utility and iron tier | Post-M9 concept only |
| Frozen Peaks / Coast / Ruins | Distinct silhouettes and environmental cues | Undecided | Backlog, no code/content obligation |

## Meadow placement contract

Safe spawn has no immediate hostile aggro and a clear route to food. Tree/berry placement teaches interaction before combat. Curious Moss Slimes occupy a recognizably different habitat from hostile encounters. Gate vegetation visually suggests the Slime's dissolve ability, with a prompt for players who miss the environmental cue.

Difficulty should come from learning attack timing, not spawning overwhelming enemies. Initial cap is eight active wild Slimes in the two-player test scene; tune with frame/tick budgets. Habitat population and respawn design remain bounded by the slice, not an ecosystem simulation.

## Capability gating

```text
Safe Meadow → berries → Moss Slime taming → dissolve-vines
                                             ↓
                                       Forest entry
```

The gate is a shared world flag. Once opened, all room members can pass even if the companion owner disconnects. Gate opening never consumes the companion. Defeat/recall cannot re-close it. Joining later receives the opened-state overlay.

Future gates must specify the capability, available acquisition route, target affordance and recovery from creature loss before content is approved. Avoid circular dependencies such as placing all taming food behind the gate requiring that creature.

## Expansion criteria

Add one complete resource/creature/capability loop per biome expansion. A color swap alone is not a meaningful new biome. Do not include climate damage, new traversal or farming as content-only Luna work until Astra establishes those mechanisms.
