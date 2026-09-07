# Astra milestone operating contract

You own the quality of one complete milestone, not the breadth of the whole game. M0 has been implemented under the explicit M0 request; see [its completion evidence](docs/milestones/M0_COMPLETION.md). M1 is [implemented and verified within its recorded test envelope](docs/milestones/M1_COMPLETION.md); M2 gathering and inventory is complete within its recorded local/hosted test envelope; M3 combat is implemented and verified locally and on Vercel; see [its mission and verification](docs/milestones/M3_COMBAT.md). M4 taming is implemented locally; see [its mission and verification](docs/milestones/M4_TAMING.md). M5 utility is implemented locally with [acceptance still pending human feedback and its recorded external checks](docs/milestones/M5_COMPANION_UTILITY.md). M6–M9 remain unstarted. Do not advance automatically.

The 2026-09-07 user-authorized [3D visual migration](docs/milestones/VISUAL_3D_MIGRATION.md) changes presentation before M2; it did not itself authorize M2 mechanics. The subsequent “Works great. Move on to next” request authorizes M2; see [its mission](docs/milestones/M2_GATHERING_INVENTORY.md).

## Before coding

Read [AGENTS.md](AGENTS.md), the [constitution](ASTRAWORLD.md), [MVP](MVP.md), [roadmap](docs/ROADMAP.md), [architecture](docs/ARCHITECTURE.md) and relevant system contracts. Identify which decisions are locked, provisional or deferred. Inspect the actual checkout; planned paths are not evidence that code exists.

Write a short task plan containing: player-visible result, in-scope systems, excluded systems, authoritative invariants, files/packages, dependencies, tests and browser scenario. For M0 use [the engine mission](docs/milestones/M0_ENGINE_SANDBOX.md); for M1 use [the multiplayer mission](docs/milestones/M1_MULTIPLAYER.md).

## During implementation

- Astra High resolves milestone design, room ownership, recovery tradeoffs and difficult integration failures.
- Astra Medium is the default for coupled first implementations; Low is suitable when the contract and failure cases are explicit.
- Establish one vertical reference before extracting broad abstractions: one collidable entity, one resource node, one attack, one tameable species, one utility barrier.
- Freeze a pattern only after rules tests and a real gameplay check pass. Document the data contract and one complete example so Luna can expand it.
- If a new requirement changes authority, persistence, protocol or progression, document the decision before spreading the change.
- Maintain evidence in a milestone completion note under docs/milestones/ when that milestone is actually executed. Include revision, environment, commands and browser findings; do not fabricate these notes now.

## Definition of done

The current milestone's entry and exit gates are met; tests and browser checks have evidence; data and authority boundaries remain intact; docs match implementation; no next-milestone feature was introduced merely to make the demo look broader. A video or screenshot alone does not establish server authority or recovery correctness.

## Original M0 mission prompt (now completed)

> Implement M0 only using docs/milestones/M0_ENGINE_SANDBOX.md. First inspect the repository and state your plan. Build the smallest top-down PixiJS/Next.js sandbox with deterministic Meadow terrain, movement, collision and camera following. Verify generation and browser behavior. Do not add multiplayer, inventory, combat, crafting, taming or persistence. Record evidence and stop at the M0 gate.

## Expansion handoff

Give Luna the exact reference implementation, definitions/schema, allowed files, requested variants, invariants and checks. Require a report identifying any engine changes it would need; those become Astra work. Astra reviews integration before the pattern or milestone is accepted.
