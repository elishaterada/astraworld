# Combat arsenal, guard and world rules

Authorized after M7 by the request for friendly fire, charge attacks, blocking/parries, ranged/melee weapon types and simple class skills. This expands combat only; M8 settlement building is not started.

## Playing

Refresh the local game at https://astraworld.localhost:1355/ and resume your Meadow. **Menu → Weapons and world rules** selects a training loadout. The world creator alone can toggle **Friendly fire** there. It defaults off, applies to every player, is saved with the world, and displays an ON cue in the combat HUD. Pets remain immune. Guests can see the setting but cannot change it, even by sending the command directly.

| Input | Keyboard/mouse | Xbox standard layout |
| --- | --- | --- |
| Normal attack | Hold primary click / J | Hold X |
| Charge normal attack | Hold K, release to strike | Hold RT, release to strike |
| Guard | Hold F / right mouse | Hold LT |
| Class skill | H / HUD skill button | RB |
| Weapon | 1–5; Z cycles; menu | D-pad down cycles; menu |
| Roll | Shift | B |
| Run | Hold V | Hold LB |
| Interact / nearby companion vine channel | E (Q also channels vines) | A |
| Companion follow/stay / recall | C / R | D-pad left / right (R3 also recalls) |

Controller detection switches the hints, HUD labels and menu mapping. Other movement, inventory and menu controls are unchanged. Weapon switching is unavailable during attacks, charging or guarding. All five loadouts are freely selectable for this combat prototype; they are not new inventory items, recipes or loot. The starter blade is retained so existing saves and crafting remain usable.

| Loadout | Normal damage | Range, tiles | Skill | Skill damage / cooldown |
| --- | --- | --- | --- | --- |
| Blade | 10 / 10 / 15 combo | 1.65 / 1.9 | Cleave: circular cut | 18 / 4 s |
| Fists | 6 | 1.2 | Palm Burst: frontal push | 16 / 3 s |
| Greatsword | 18 | 2.1 | Quake: circular slam | 24 / 6 s |
| Bow | 10 | 9 | Volley: three spread arrows | 12 per arrow / 5 s |
| Magic | 12 | 8 | Nova: circular magic burst | 18 / 6 s |

Skills share one cooldown timestamp across weapon changes, so switching cannot reset it. Volley cannot hit the same target repeatedly. Skills have fixed power; charge boosts normal attacks only. No ammunition, mana, stamina, equipment statistics, leveling or skill tree is introduced. These are original provisional mechanics and geometry, not assets or skill implementations copied from another game.

## Combat rules

- Charging uses elapsed authoritative ticks, capped at one second. Full charge doubles normal damage and adds up to 0.6 tiles of collision-safe knockback. Movement during charge/guard is 45% walking speed. Guarding, rolling, death, pause and disconnect cancel a held charge; they do not release an unintended attack. Stale input clears held guard/charge after six server ticks without processed input.
- Guard covers a forward cone (direction dot product ≥ 0.25). The first seven ticks (~117 ms at 60 Hz) are a perfect parry: no defender damage, incoming damage reflected to the opponent, and its attack interrupted. Later guarded hits deal 25% chip damage, rounded up to at least one HP. Rear hits deal full damage. Starting another guard requires 30 ticks since the previous start, preventing instant repeated parry resets. A parry does not recursively parry its reflected damage; existing invulnerability still applies.
- Bow and magic fire from the attack's captured origin/facing after windup. Swept segments and terrain line checks prevent tunneling through walls; each ray is consumed on its first eligible hit. Each attack records hit IDs (up to 14 to cover six enemies and seven other players). Authoritative simulation resolves player strikes against enemies, then optional player damage, then hostile impacts. It uses stable actor order, not a globally nearest-target sort for simultaneous candidates within one projectile segment.
- Friendly fire uses the same guard, invulnerability, death, respawn and retained-inventory rules as hostile damage. Offline actors and pets cannot be damaged. The setting is a world-wide rule, not per-player consent or a competitive PvP mode.
- Damage and parries use present server state. Local intent/poses are predicted; outcomes, elapsed charge, hit targets, reflection, knockback and cooldowns are server-owned. There is no latency rewind. Tight parry fairness over high-latency connections remains unverified.

## Implementation and compatibility

`packages/content/weapons.ts` separates five definitions from combat instances. Shared pure input/combat simulation owns timing and outcomes. Validated frames carry only held charge/block and one-shot skill/equip/cancel intents; forged damage and invalid loadouts are rejected. The authenticated member with spawn index zero owns the world setting. Sequenced setting commands use the existing receipt/journal path, and settings/loadouts participate in the durable publication barrier.

Wire protocol **6** adds optional loadout, charge, guard, parry, skill, projectile and world-rule state. Existing saved IDs, terrain versions and namespaces remain unchanged; missing fields mean blade and friendly fire off. No SQL table migration or new service is needed. Deploy clients and both gateways together; old protocol clients must refresh. Browser reloads restore rules/loadout; PostgreSQL recovery preserves skill cooldowns. Held charge/guard is cleared when establishing a new connection generation.

Three.js uses bounded reusable bow/staff meshes, a larger sword, alternating punches, three projectile meshes per actor, charge/guard rings and radial skill effects. Remote actors consume the same replicated state. Geometry/materials are disposed with the character. Reduced-motion handling retains static state cues without the extra sweep effects. The compact HUD shows the equipped class, skill cooldown and current charge/guard/parry state.

## Verification

- **100/100 automated tests passed**, no failures or skips, with real PostgreSQL. New coverage includes charge timing/burst resistance, stale-input cancellation, frontal/rear guards, chip/parry/death behavior, friendly-fire permissions/idempotency, swept ranged hits/walls, skill cooldowns across weapon changes, strict frames, and additive saved-world recovery. [Suite](evidence/arsenal-tests.json).
- Two independent authenticated Chromium contexts exercised weapon selection, held charge/release, bow/magic projectiles and skills. A guest's forged setting request was rejected; owner changes propagated. Friendly fire off preserved 100 HP; a late block reduced an 18-damage hit to 5 HP; a timed parry reflected 18 damage without further defender loss. Reload restored the setting and greatsword. No page errors. [Report](evidence/arsenal-browser.json), [bow](evidence/arsenal-bow.png), [magic](evidence/arsenal-magic.png), [block](evidence/arsenal-block.png), [parry](evidence/arsenal-parry.png).
- Simulated standard Gamepad API browser input verified RT charge/release, LT guard, RB skill, D-pad weapon switching, contextual hints, movement/combo/roll, menus and disconnect behavior. [Controller report](evidence/gamepad-browser.json). Physical Xbox hardware was not available.

- Final TypeScript checking and optimized Next.js production build passed. The complete suite was rerun after fixing skill power to stay independent of held charge.
- Existing two-context combo/remote finisher/recovery-roll and reduced-motion browser checks passed. The full two-player gathering → combat → taming → interrupted gate channel → shared Forest-entry regression also passed, including 150 ms application-level added RTT. [Adventure report](evidence/arsenal-slice-browser.json).
- Browser test development exposed asynchronous checkbox state, menu pointer aim, and a race that enabled friendly fire before the preceding swing had recovered. The final test explicitly re-aims, waits for the second browser to receive each attack, waits out recovery, and requires a new parry timestamp. No health assertions were weakened. The corrected two-player scenario passed twice consecutively (37.6 seconds total).

No hosted deployment, eight-player performance/loss soak, Safari/Firefox matrix, physical controller acceptance or competitive balance test is claimed. Existing M6 provider/human acceptance limitations remain. Art is placeholder geometry; no combat audio or new enemy species are included.
