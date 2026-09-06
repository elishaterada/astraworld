# Creature, taming and companion systems

## Reference architecture

`CreatureDefinition` holds species, temperament, stats, habitat, ability IDs, tame rules and visual IDs. `CreatureInstance` holds entity identity, health, state, target, cooldowns, origin spawn and owner. `CreatureBrain` selects deterministic state transitions. `TamingState` tracks a temporary feeder claim and accepted feeds. `CompanionController` interprets owner commands. `CreatureAbility` handlers resolve combat/environment effects through server rules.

Implement these responsibilities with small typed modules; the names do not mandate a class hierarchy. Wild and owned creatures share the same instance identity and collision/network representation. No LLM calls in their brains.

## First species contract

| Property | Hostile Slime | Moss Slime |
| --- | --- | --- |
| Role | Combat learning encounter | Taming and utility reference |
| Temperament | Hostile | Curious |
| Combat | Telegraph then body slam | Combat assist deferred until after utility slice |
| Taming | Not tameable in slice | Three Sweet Berries |
| Utility | None | Dissolve designated vine barrier |
| Habitat | Away from safe spawn | Reachable Meadow food area |

The long-term per-species goal is combat plus world utility; the slice deliberately proves the Moss Slime's environmental role first. Acid Spit, watering, marsh crossing and stump digestion are future examples, not additional M4/M5 requirements.

## Taming state machine

WildCurious → FeedingClaim → TamedFollowing. FeedingClaim may expire back to WildCurious; accepted feed progress resets on expiry. TamedFollowing can switch to Staying or Recovering. There is no RNG capture roll or requirement to injure the creature.

First valid feed claims the creature for that character for a provisional 60-second window, renewed on each accepted feed. Validate actor alive, same world, range ≤1.5 tiles, line of interaction, creature curious/unowned, no active companion already, one berry available and feed cooldown (initial 1 second). A different player receives “being befriended” without consuming food. Disconnect does not transfer the claim; it expires normally. Explain expiration/reset in UI so lost fed berries are not silent.

Each accepted feed consumes one berry and increments progress atomically. The third feed also sets owner and active companion, clears wild AI/claim, and marks the origin spawn claimed. Competing final feeds or retried command IDs cannot yield two owners or consume extra berries. Before M6 these guarantees are session-local; M6 persists the whole transition.

## Following and commands

One active companion per character. Default follow distance is 1.5–3 tiles; use direct steering when clear and bounded grid pathfinding when blocked. Replan at a lower cadence than movement (initial 5 Hz). Avoid teleporting every time pathfinding is inconvenient.

If separated beyond 12 tiles or stuck for 3 seconds, recall may place the companion at a verified free point near its owner. Recall cannot cross a locked progression boundary independently: place only in the owner's reachable region. If no valid point exists, show recovering and retry with a bound. Never spawn inside walls or on another actor.

Follow, stay and recall are owner-authorized actions. On owner disconnect, stop combat/utility commands and retain the creature in session state; reconnect restores it. Durable owned creatures do not respawn through habitat logic. No permanent companion death in the slice.

## M5: Dissolve Vines

Owner targets a designated vine entity and presses Q. Server validates owner, companion active and able, actor/companion alive as applicable, target tag, companion range (initial 2 tiles), line of ability, cooldown and closed state. Begin a visible 1-second channel; cancel on disconnect, invalid range or incapacitation without opening the gate.

At completion revalidate, mark the barrier open and remove its collision together. Broadcast the same world event to both players. Duplicate completion returns already-open state without a second effect. The opening is shared and survives companion recall; from M6 it survives restart. Ordinary vegetation is not an eligible utility target.

## Expansion boundary and acceptance

Boar food-luring, Wolf tracking, Golem mining, Salamander heating, Sprout farming, egg hatching, evolution and breeding are future concepts. They need new handlers and invariants, not just a species file. Astra creates those references before Luna adds variants.

M4 checks three feeds, contention, expiry, disconnect, follow/stay/recall and no duplicate wild spawn. M5 checks gate targeting, interruption, both-player traversal and recovery. Test clients cannot command another character's companion or open a gate by sending an “ability succeeded” message.
