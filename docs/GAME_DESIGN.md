# Game design

## Core loops

Slice: explore Meadow → gather berries → encounter hostile Slime → befriend Moss Slime → use companion → enter Forest clearing.

Long term: explore → gather → improve camp and equipment → understand local creatures → tame for new capabilities → access a new resource/biome → face a biome challenge → return home with new options.

Resources, gear and companions should reinforce this loop. Avoid separate progression ladders that never affect exploration. Environmental utility should be understandable before a player commits to taming.

## Default controls

| Input | Slice behavior | Later extension |
| --- | --- | --- |
| WASD | Move; normalize diagonal speed | Remapping |
| Mouse | Aim and select world target | Additional ability targeting |
| Left click | Starter weapon attack | Weapon classes |
| Space | Dodge | None required |
| E | Context interaction / feeding | Workbench and storage interaction |
| Q | Companion utility on eligible target | More ability types |
| I | Compact inventory | Full inventory UI |
| Escape | Close panels; settings | Does not pause shared simulation |
| Companion UI | Follow, stay, recall | Stable/party management later |

Right click secondary actions and number-key skill bars are deferred until there is content requiring them. Typing or focusing a UI control suppresses world shortcuts. Closing a tab must release movement input through timeout on the server.

## Cooperative rules

Each character has an individual inventory and at most one active companion. World barriers and resource depletion are shared. Successful gathering grants the requesting player items; there is no free inventory transfer or ground-drop trading in the slice. Taming claims one creature for one character, while its opened path benefits everyone.

Friendly fire and PvP are off. A second player cannot command or release another player's creature. Joining another world never imports progression or entities implicitly. Only invited members may enter a private world.

## Progression and recovery defaults

The starter blade and hatchet are granted equipment, removing a circular requirement to craft the tool needed for the first resource. Sweet Berries are the only taming item. No hunger, thirst, durability, experience levels or armor calculations in the slice.

On player death, respawn at the safe Meadow spawn after a short visible delay, retain inventory and companion, and restore health. This is a provisional low-punishment rule to protect slice testing. Death must cancel pending attacks and interactions. Companion incapacitation uses recall/recovery, not permanent loss. Spawn protection ends after a short timeout or an offensive action, whichever comes first; tune and test in M3.

## Content and feedback

Interaction prompts identify the target and action. Feeding displays accepted progress out of three; failed feeding states why no berry was consumed. Attacks have anticipation, active impact and recovery. Taming changes body language, ownership cue and follow behavior. Vine dissolution visibly removes collision and celebrates a new route for both players.

Discovery is physical movement into the world; a full minimap/fog-of-war system is deferred. The Forest transition should be visible through terrain, vegetation and ambience without a scene-loading interruption.

See [COMBAT.md](COMBAT.md), [CREATURE_SYSTEM.md](CREATURE_SYSTEM.md) and [CRAFTING_BUILDING.md](CRAFTING_BUILDING.md) for system rules and deferred ambitions.
