# MVP: cooperative adventure vertical slice

## Scope boundary

The latest 2D decision supersedes the earlier crafting-first and three-biome proposals. **M0–M5 deliver a session-based adventure slice. M6 adds durable persistence. M7 adds crafting, M8 adds settlement building, M9 adds a fuller Forest and boss.** The first persistent playable release is M0–M6; it is not the complete long-term product.

## The 10–15 minute scenario

1. Player A creates an invite-only test world; player B joins from a separate browser session.
2. Both spawn in a safe procedural Meadow and see each other move and collide correctly.
3. Gather Sweet Berries and wood from reachable nodes; wood demonstrates resource collection but has no required crafting sink yet.
4. Fight a hostile Slime with a starter melee weapon and a readable dodge.
5. Discover a separate curious Moss Slime. A proximity prompt identifies Sweet Berries as its food.
6. One player feeds it three berries through separate server-validated interactions. It becomes that player's companion exactly once.
7. The companion follows through ordinary terrain and recovers from getting stuck.
8. At a vine-blocked passage, its owner commands Dissolve Vines. The barrier disappears for both players.
9. Both walk into a small Forest clearing. Show the completion cue and stop progression there.

Killing the hostile Slime is an encounter beat, not a hidden prerequisite for feeding a different tameable Slime. Do not require crafting jelly, low-health capture or random capture rolls.

## Minimum content budget

| Category | Required slice content |
| --- | --- |
| World | One finite seeded map, Meadow plus Forest entry clearing, one mandatory vine gate |
| Players | Up to eight concurrent humans, with a chosen cosmetic appearance each (M1 capacity expansion) |
| Resources | Berry bush and tree; wood and Sweet Berry inventory stacks |
| Equipment | Granted starter blade and hatchet; no crafting dependency |
| Creatures | Hostile Slime and tameable Moss Slime using one creature framework |
| Combat | One player melee attack, one dodge, one hostile attack, health and respawn |
| Companion | One active companion per player, follow, stay, recall and targeted vine utility |
| UI | Join state, connection state, health, compact inventory, interaction/food hint, companion cue |

M4 proves follow and ownership; M5 adds utility. Inventory is intentionally minimal, with no storage containers or trading. Baseline movement/timing defaults are in [networking](docs/NETWORKING.md); gameplay defaults are in the relevant system documents.

## Acceptance

- Two fresh players finish the entire loop without developer intervention in a seeded test world.
- Sharing the last berry bush or feeding the same creature cannot double rewards or ownership.
- Movement, interaction range, damage, feeding and gate opening are server validated.
- A reconnect within the configured session recovery window restores identity and a consistent snapshot. It cannot replay a feed or loot award.
- Every supported test seed supplies a reachable berry source, tameable spawn and valid route through the gated clearing.
- Performance and fault scenarios in [TESTING.md](docs/TESTING.md) pass, or the milestone remains explicitly incomplete.

## Session versus durable behavior

Through M5, rooms use Redis-backed hot checkpoints and a proposed 30-minute empty-room retention window. A Redis loss or deliberate test reset can lose progress; the UI must label the world as a session prototype. Ordinary gateway reconnects and owner rotation must recover during that window. Do not market session recovery as durable saving.

M6 makes acknowledged inventory awards, creature ownership and world modifications durable in Postgres; it proves process restart and Redis-loss recovery. Only then label the world persistent. This sequencing avoids pretending that Redis alone fulfills the long-term promise.

## Do not add to the slice

Crafting, houses, storage, farms, ore tiers, bosses, Marsh, weather simulation, day/night effects on rules, skill trees, progression levels, evolution, breeding, trading, PvP, mobile controls, account settings or LLM-driven gameplay. A Forest clearing is the reward, not an excuse to implement a second full biome.
