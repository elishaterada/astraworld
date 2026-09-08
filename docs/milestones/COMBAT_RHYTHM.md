# Melee rhythm and impact

Authorized by “Make the battle mechanic more interesting and lively like Minecraft Dungeons.” This is a focused upgrade to the existing blade and Slime encounters, after M7 and the creature population expansion. No M8 building, bosses, loot system, ranged weapons or new abilities are included.

## Design

The reference is Dungeons’ emphasis on combo timing and weaving rolls into combat ([official developer discussion](https://www.minecraft.net/pt-br/article/dungeons-september-dev-blog)). The tuning and art below are original choices for Astraworld.

Hold primary click or J to keep attacking; release to stop. Consecutive attacks alternate swing direction, then finish with a heavier gold sweep. Shift plus a direction can cancel attack recovery, but never windup or active damage frames. Rolling resets the chain. Releasing for longer than the chain window resets it too. The existing one-second roll cooldown and collision/invulnerability rules remain.

| Stage | Windup / active / recovery, ticks at 60 Hz | Damage | Range |
| --- | --- | --- | --- |
| First cut | 9 / 6 / 21 | 10 | 1.65 tiles |
| Return cut | 9 / 6 / 15 | 10 | 1.65 tiles |
| Finisher | 12 / 8 / 22 | 15 | 1.9 tiles |

The chain window is 48 ticks after recovery. A finisher moves a struck hostile up to 1.1 tiles through the normal swept collision routine, cancels its telegraph, and gives a 45-tick recovery opening. It can hit multiple eligible enemies once each. Friends and pets remain immune. There is no client-submitted damage, combo stage or knockback coordinate.

## Authority and presentation

- Shared `applyFrame` predicts and authoritatively chooses combo stages from prior state and server ticks. Holding attack sends normal bounded intent frames; packet bursts cannot advance cooldowns. Pause, lost focus, key release and pointer release/cancellation clear held controls. There is no unattended auto-attack or out-of-range targeting.
- Damage, displacement and interruption are resolved by pure combat simulation, with all player strikes before enemy impacts. Original corpse IDs and durable population rules are retained.
- Optional combo/last-damage/stagger fields let existing saves load. Protocol **5** prevents old clients from interpreting the new action state. Keep saved namespaces and terrain IDs; deploy all clients/gateways together and refresh tabs. No database table migration or cloud service was added.
- Swing arcs, alternating torso turns, finisher lean, enemy anticipation hops, hit recoil, damage feedback and eight pooled spark cubes per hostile are visual only. Remote players use replicated combo stages and ticks. Reduced motion hides slash arcs and sparks and suppresses the extra torso/recoil/jump motion. Effects never pause simulation or determine hits.
- Effect geometry/materials are bounded and disposed with character/creature views. The one-time hint and menu controls explain the new inputs without adding persistent HUD panels.

## Verification

- **89/89 automated tests passed**, zero failed or skipped, using real PostgreSQL. Coverage includes timed combo stages, burst resistance, chain expiry, recovery-only roll cancellation, single-hit finishers, interruption and swept wall collision, plus existing multiplayer, durable-state and contention regressions. The first new wall assertion used an incorrect body radius; it was corrected to the existing 0.24-tile collision contract. [Suite](evidence/combat-rhythm-tests.json).
- TypeScript and optimized production build passed.
- Two independent browser contexts verified held attacks, replicated third-hit stage, recovery cancellation into a remote-visible roll, and no new attacks after release. No page errors. Sampled p95 frame time was 16.7 ms with 152 draw calls, 346,718 triangles, 14 geometries and four textures. This is a local sample, not an eight-window performance gate. [Report](evidence/combat-rhythm-browser.json), [finisher](evidence/combat-rhythm-finisher.png).
- The existing two-player gathering → combat → taming → interrupted gate channel → shared Forest-entry journey passed, including its 150 ms application-level added RTT. [Journey](evidence/combat-rhythm-slice-browser.json). Reduced-motion browser play reached the third combo stage with slash effects disabled; it passed in 3.3 seconds. Agent-browser also entered the game and confirmed the updated control description.

No production deployment, new TCP-loss soak, eight-window acceptance or Safari/Firefox matrix was run. M6 backup/provider and human acceptance gates remain open. Art is still placeholder geometry; there is no combat audio, aim assist, extra enemy attack type or new loot. The local game is running at https://astraworld.localhost:1355/. Refresh and resume after this protocol update.
