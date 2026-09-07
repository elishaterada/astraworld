# Milestone roadmap

**M0 is complete locally (G0/R0/R1 and ten-minute performance PASS)**; see [its completion evidence](milestones/M0_COMPLETION.md). M1 has a [deployed implementation](milestones/M1_DEPLOYMENT.md) with lifecycle/overlap verification passed and true TCP packet-loss validation pending; M2–M9 are **not started**. Milestone names below normalize the different numbering used in the conversation; use these IDs in future tasks.

M1 responsiveness revision: [protocol 2 contract and evidence](milestones/M1_RESPONSIVENESS.md), including Vercel-only hosting, predicted input, facing and wave synchronization.

## Sequence and gates

| Milestone | Entry / owner | Deliverable and exit gate | Explicit stop line |
| --- | --- | --- | --- |
| M0 Engine sandbox | Implementation requested; Astra Medium, High for unresolved design | Next.js/PixiJS, seeded Meadow, actor, camera, collision; reproducible generation and measured browser movement | No multiplayer, inventory, combat or services |
| M1 Authoritative multiplayer | M0 passed; Astra High designs, Medium implements | Up to eight independent clients in one room, input validation, interpolation/reconciliation, Redis hot recovery; host lifecycle/failover spike passes | No gathering, combat or Postgres gameplay persistence |
| M2 Gathering and inventory | M1 passed; Astra Medium/Low | Tree, bush, granted tools, wood/berries, inventory; race and retry tests pass | No crafting or storage |
| M3 Combat | M2 passed; Astra Medium | One weapon, dodge, hostile Slime, health and respawn; both clients agree on results | No weapon roster, bosses or skill trees |
| M4 Taming and following | M3 passed; Astra Medium | Curious Moss Slime, three feeds, exclusive ownership, follow/stay/recall; duplicate/competing claims pass | No breeding, evolution or utility catalog |
| M5 Companion utility and slice polish | M4 passed; Astra Medium, High reviews | Dissolve gate, Forest clearing, full 10–15 minute cooperative loop and playtest evidence | No full Forest, crafting, buildings or durable-save claims |
| M6 Durable cooperative release | M5 gameplay accepted; Astra High designs, Medium implements | Postgres transactions, stable identity binding, inventory/companion/world recovery, eight-player durable-state load check | No economy, multi-region writers or complex accounts product |
| M7 First crafting loop | M6 passed; Astra reference then eligible Luna content | Stone, Stone Axe, one recipe path, restricted Workbench placement; costs/results durable and idempotent | No crafting tree, queues or full settlement kit |
| M8 Settlement reference | M7 passed; Astra reference then eligible Luna variants | Floor/wall/door/chest, placement, access and atomic transfer; a usable saved room | No terrain editing, multi-floor physics or offline automation |
| M9 Forest progression | M8 passed; Astra High scopes | One fuller Forest loop, one companion/environment extension and Forest Guardian with defined tests | No automatic Marsh/Coast rollout |

M0–M5 are the adventure prototype. M0–M6 are the first persistent cooperative release. M7–M9 are subsequent product growth. No calendar estimates are asserted before the reference implementation supplies evidence.

## Dependencies and checkpoints

M1's hosting/ownership experiment is a hard gate for distributed multiplayer. Local success alone does not prove Vercel lifecycle behavior. If external access is unavailable, record local progress and leave deployed-host acceptance pending; do not pretend M1 is complete or implement later mechanics to compensate.

M2 introduces command-level session idempotency. M4 applies it to irreversible session ownership. M6 upgrades those contracts to durable transactions instead of redesigning authority from scratch.

M5 requires gameplay feedback, not only automated checks. If companion utility is unclear or the loop is unfun, refine the existing slice before expanding content. M6 requires restart/Redis-loss evidence before calling the game persistent.

## Completion artifact for each implemented milestone

Record scope, revision, key decisions, exact checks and outcomes, browser environment, performance evidence, open defects and next eligible work. Link changed contracts. A gate can be passed, failed or blocked by a named dependency; “mostly done” is not acceptance.

Use [M0 mission](milestones/M0_ENGINE_SANDBOX.md), [M1 mission](milestones/M1_MULTIPLAYER.md) and [TESTING.md](TESTING.md) to start. Later mission briefs should be written just before their execution, using evidence from preceding milestones rather than speculative implementation detail.
