# M4 taming and companions — 2026-09-07

Authorized by “ok lets proceed to M4.” Active milestone M4; stop before M5.

Implement two curious Moss Slimes at the reserved clearing spawn sites, three separately validated Sweet Berry feeds, one companion per player, and owner-only follow/stay/recall. Feeding, receipts and ownership commit atomically with inventory in the existing fenced room checkpoint. A sixty-second renewable claim expires without refund and resets feeding progress; no competing player consumes food. Claims survive disconnect until expiry. Taming preserves the spawn instance ID permanently within the temporary session, rather than spawning a second creature.

The validated definition uses a one-second feed cooldown, 1.5-tile feed range, 1.7-tile follow distance, 4.4-tile/sec movement and 5 Hz bounded path replanning. Cardinal BFS expands at most 512 nodes per ordinary route. After separation beyond 12 tiles or three seconds stuck, safe recall checks connectivity across the finite map and chooses a clear point near the owner, avoiding actors/companions. Failed recovery retries once per second, including during repeated commands. Owner controls have a half-second cooldown. Dead/disconnected owners stop following. Combat cannot target these creatures. No companion damage, utility, taming RNG, new items, cloud provisioning or durable saves.

Changes belong in content, protocol, pure simulation, the existing gateway checkpoint, transport client, Three.js view and compact contextual UI. M4 uses an isolated `taming-1 / p8-c4-m4` room version, retaining Meadow geometry. UI: E feeds nearby wild Moss Slimes; C toggles follow/stay and R recalls one's companion. Explicit UI buttons provide the same owner commands.

Acceptance: claims, competing third feeds, replay/sequence/generation protection, exact berry consumption, one companion per player, expiry/disconnect, collision/pathfinding/recall connectivity, reconnect/owner turnover and no duplicated spawn. Run typecheck, rules/integration tests, build and actual two-context gameplay. Record results and limitations below. No M5 implementation.

## Results

Local verification on 2026-09-07, Node 24.13.0, Next 16.3.4, Redis 8.10.1, Chromium 153.0.8010.12:

- `npm run typecheck`: PASS.
- `npm test`: PASS, 61 tests across 19 files (16.44 seconds). Includes seven pure taming tests and a real Redis/two-gateway test for claim contention, exact consumption, stale/duplicate intent, replacement connection generation, ownership retention and two owner turnovers. An obstacle movement test checks every step for collision and maximum speed; a closed-region test rejects recall across a complete wall. [Existing transport integration rerun](evidence/m4-integration.json).
- `npm run build`: PASS.
- `BASE_URL=https://astraworld.localhost:1355 COMBAT_EVIDENCE_PREFIX=docs/milestones/evidence/m4-combat GATHER_EVIDENCE_PREFIX=docs/milestones/evidence/m4-gather npx playwright test tests/e2e/taming.spec.ts tests/e2e/combat.spec.ts tests/e2e/gathering.spec.ts tests/e2e/compact-hud.spec.ts`: PASS, four browser tests in one minute. Two independent authenticated contexts competed for the same Moss, consumed exactly three winner berries and zero loser berries, followed, stayed, recalled and resumed the same identity/ownership/inventory after reload. [Taming measurements](evidence/m4-browser.json), [feeding](evidence/m4-feeding.png), [following](evidence/m4-following.png), [recall](evidence/m4-recalled.png).
- Combat regression passed with 150 ms added application-layer round-trip delay (not TCP loss); [measurements](evidence/m4-combat-browser.json). Gathering/depletion/reconnect passed; [measurements](evidence/m4-gather-browser.json). Compact inventory/first-play hint/focus and 800×600 layout passed; [small HUD](evidence/m4-hud-small.png). No browser page errors were recorded.
- Agent-browser entry/snapshot/error check passed after the final local server restart. Rendered feeding/following screenshots were visually inspected. Prior milestone evidence was preserved under its original filenames.

## Play and limits

`npm run dev` serves [the stable local address](https://astraworld.localhost:1355). Use normal entry, create a new Meadow and share a fresh invitation. Gather berries near spawn, approach either green Moss Slime west/south of the clearing and press E three times, a second apart. C toggles follow/stay; R resumes following and recovers a distant/stuck companion. Inventory stays behind I; compact owner controls appear after taming.

M4 is local only; no commit, push, deployment, new service or permanent-save migration was performed in this task. Hosted M3 remains the deployed version. The room supports eight players but this reference contains only two tameable creatures; one per player is a maximum, not a guarantee that every member gets one. Further species/spawns and load testing all eight companions are deferred. Wild curiosity is idle presentation, not roaming AI. Claims expire sixty simulation seconds after the last feed without refund. Redis room expiry or a local ephemeral Redis restart loses the session. The offline solo harness does not include taming. Full-map recall connectivity is bounded by the 128×128 map and currently handles static collision; M5 must include future dynamic gate state before adding its utility. No new hosted packet-loss or ten-minute companion soak was run.

Next eligible task: M5 Dissolve Vines, Forest clearing and cooperative slice polish, only after explicit authorization.

