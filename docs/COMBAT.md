# Combat system

## M3 reference scope

One starter melee weapon, one dodge, one hostile Slime attack, health, damage, death and safe respawn. Exclude heavy/secondary attacks, blocking, ranged weapons, armor, skill trees, status stacks and elaborate combos. Later weapon/ability definitions can expand only after the first attack lifecycle is verified.

## Attack lifecycle

Idle → windup → active → recovery → idle. Server stores action start tick and facing, checks cooldown, and evaluates hit geometry during active ticks. Each attack instance tracks hit target IDs so a target takes damage once, not every tick or snapshot. Server checks range, collision/line of attack, target eligibility and friendly-fire rules.

Proposed first tuning values: player health 100, blade damage 10, hostile Slime health 30 and damage 10. Player melee uses 150 ms windup, 100 ms active and 350 ms recovery; hostile tells begin at least 400 ms before impact. Quantize timings to server ticks and document the final values in content. Values are defaults, not approved balance.

## Dodge and lag behavior

Dodge is a server-resolved short movement burst with a bounded cooldown (initial 1 second). Define any invulnerability window explicitly (initial 150 ms of a 250 ms dodge) and never let it ignore walls. Prediction may show the local burst, but damage outcome follows authoritative timing.

Use present server state for hit resolution in the slice. No historical rewind or client hit confirmation. At 150 ms simulated RTT, test that telegraphs remain readable; tune anticipation before building lag-compensation history. Record that high-latency fairness is limited by this choice.

## Creature and player outcomes

Hostile Slime uses idle/wander → acquire target → telegraph → attack → recover, with a bounded chase distance and return-to-habitat behavior. Curious Moss Slime is not a combat target in the slice, avoiding accidental loss of progression. Owned companions cannot be attacked by other players.

Player death cancels actions, clears motion and respawns safely with retained items. Killing a hostile Slime emits one death event and a visual defeat cue. Physical loot piles are deferred; any later configured inventory drop must use the same idempotent reward mechanism as gathering, never be minted by animation completion.

## Acceptance

One swing hits each eligible target at most once; walls and cooldowns cannot be bypassed; forged damage/position messages do nothing; dead actors cannot act; duplicate death processing cannot award twice; both clients agree on health/death; attacks cannot damage friendly players or curious Slimes. Browser check must show tells, impact and recovery clearly with two overlapping players.
