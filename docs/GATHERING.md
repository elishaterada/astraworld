# Gathering and minimal inventory

## M2 slice scope

Two node types: berry bush yields Sweet Berries, tree yields wood. Give a starter hatchet; gathering does not depend on crafting. Inventory is a server-owned collection with a compact UI. Proposed defaults: 12 slots, stack size 99 for both resources, no weight/durability or dropped bags.

For initial testing, each bush yields three berries and each tree three wood. These are provisional balance values. The generator must guarantee at least six accessible berries and two curious Slime spawn slots. See [WORLD_GENERATION.md](WORLD_GENERATION.md).

## Gather action

Client sends target ID and command ID. Server validates world membership, target exists and is active, actor alive, correct tool if required, range (initial 1.5 tile units), line of interaction, action cooldown and inventory capacity. A proposed 500 ms gather interval prevents instant repeated harvesting. Cosmetic chop animation is not the timer authority.

Resolve contention through the room owner. If two players request the final harvest, exactly one succeeds; the other sees depleted/stale-target feedback. Reward and depletion update atomically in session state, and in a durable transaction from M6. Full inventory rejects the action without depletion. No partial reward or silent drop to the ground in the slice.

## Inventory rules

Stack by definition ID, fill existing stacks then empty slots in stable order. Quantities are positive integers. The browser never supplies resulting quantity. Feeding consumes berries through the same server inventory service. Starter grants use one idempotent grant key per character so reconnect cannot duplicate equipment.

Do not add containers, trading, drag-to-world drops, sorting customization or cross-world item transfer. A simple item list/count UI is sufficient until crafting needs slot interaction.

## Acceptance

Two simultaneous gather requests yield one depletion and one award; retries return the original result; out-of-range and wrong-tool actions change nothing; full inventory leaves the node intact; reload retains depletion during session recovery; M6 crash/retry preserves both reward and depletion. Capacity and stack boundaries get direct rule tests.
