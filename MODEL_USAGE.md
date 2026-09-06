# Model usage: Astra High / Medium / Low and Luna 4.6

## Governing principle

**Astra establishes new systems and working reference implementations. Luna expands established patterns and content.** Planning alone does not make a new engine safe to hand off: early implementation choices are architecture choices.

Use this project workflow:

```text
Astra High: define milestone and invariants
  → Astra Medium/Low: implement one end-to-end reference
  → tests plus gameplay verification
  → document and stabilize the pattern
  → Luna: bounded expansion using the same pattern
  → Astra: integration review and milestone acceptance
```

## Naming and execution caveat

“Luna 4.6” is preserved here because it is the label in the conversation and requested handoff. It is not a verified model identifier. On 2026-09-06, official documentation lists **GPT-6 Astra** (`gpt-6-astra`) and **GPT-5.6 Luna** (`gpt-5.6-luna`); the current desktop tool catalog also exposes those IDs. Astra supports low, medium and high reasoning among its settings. Sources: [Astra model](https://developers.openai.com/api/docs/models/gpt-6-astra), [Luna model](https://developers.openai.com/api/docs/models/gpt-5.6-luna).

Do not silently substitute 5.6 for a user-requested 4.6 or invent `gpt-4.6-luna`. At the first actual Luna dispatch, resolve the user's intended available model in the current environment and record its ID and reasoning effort. That uncertainty does not block planning or authorized Astra implementation. High/Medium/Low below are effort choices on Astra, not separate models.

## Allocation matrix

| Work | Owner / effort | Reason and completion expectation |
| --- | --- | --- |
| Product constitution, milestone scope, progression design | Astra High | Resolve interacting constraints and establish explicit non-goals |
| Authority model, owner fencing, durable transactions | Astra High | Failure behavior and cross-system invariants need deliberate design |
| First multiplayer, entity, combat or creature system | Astra Medium | Build a tested reference across integration boundaries |
| First small mechanism with complete contract | Astra Low | Execute defined rules; increase effort if design gaps emerge |
| Difficult race, reconnect exploit, migration or architectural bug | Astra High | Diagnose the invariant and repair the cause |
| Routine fixes in established architecture | Astra Low or Luna | Select by ambiguity and blast radius, not file count |
| Species, recipes, items and biome variants using existing handlers | Luna 4.6 (label; resolve ID above) | Schema-driven content with no new engine mechanics |
| UI using an approved design and existing state contracts | Luna | Bounded component behavior and browser acceptance |
| Additional tests for documented invariants | Luna | Independent expected outcomes; Astra reviews missing failure cases |
| Refactor with fixed behavior and existing coverage | Luna | No hidden authority, persistence or protocol redesign |
| Cross-system review and milestone acceptance | Astra Medium/High | Review interaction failures and player experience |

## Escalation rules

Start foundational execution on Astra Medium; use Low when the interfaces and test oracles are explicit. Move to High when requirements conflict, state ownership is ambiguous, failure recovery is unclear or a fix would cross multiple system contracts.

Luna must return novel verbs to Astra: a new taming method, swimming, trading, breeding, ability targeting, inventory transfer semantics or schema migration is a system change even if it begins in a content file. Stop repeating a failing approach after two unsuccessful repair attempts; hand over a concise reproduction, expected result, observed result and attempted fixes.

“Astra creates verbs, Luna creates nouns” is a useful allocation heuristic, not a restriction on Astra writing content or Luna writing code. A new noun that needs a new verb is Astra work first.

## Ready-for-Luna checklist

- An end-to-end reference works and has browser evidence where relevant.
- Contracts, valid IDs and invariants are documented.
- Allowed files and exact deliverables are bounded.
- Acceptance checks include incorrect inputs and references, not just happy-path snapshots.
- The task can succeed without changing simulation, transport, ownership or persistence contracts.

Example: after Astra proves Moss Slime and a second species adds no new mechanics, Luna may add three Meadow variants using the existing body-slam, follow and dissolve-vines handlers. “Add a flying companion” is not content expansion until Astra has built flight and its collision/network rules.

## Cost and quality feedback

Track accepted tasks, elapsed time, retries, review corrections and measured usage if available. Evaluate cost per accepted feature, including repair and review. Do not claim Astra Low is always cheaper or Luna is always more economical; this package makes no pricing or benchmark promise. Keep stable instructions and task scope compact, and measure representative tasks before expanding delegation.
