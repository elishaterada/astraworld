# M2 compact HUD refinement — 2026-09-07

User request: conventional desktop game UI with hidden inventory slots, one-time movement guidance and less persistent chrome. This refines completed M2; M3 remains unstarted. No network, authority, content or world-generation contracts change.

## Implemented behavior

- Bottom-right satchel button and I shortcut open the 12-slot inventory; I/Escape/Close restore game focus. Native dialog focus prevents WASD or gather actions while examining inventory. Other players keep playing.
- Escape from the world opens the pause menu. Controls are available there on demand.
- A dismissible first-play hint disappears after ten active seconds; browser-local preference suppresses it on later visits. This is UI preference storage, not saved gameplay.
- Nearby resources get a compact E prompt. Confirmed item gains and rejections last three seconds; the closed satchel does not hide important feedback.
- Smaller location/party display; persistent movement strip and verbose session/art footer removed. Connection failures remain visible. Art-study/recovery details remain in entry/menu.
- Fullscreen fallback notice moves next to the fullscreen button and disappears after five seconds.

## Validation

Results recorded after the final confirmation below. Tests use the actual production build on local port 3002 and existing gateways. Existing M2 gathering browser coverage now opens inventory before checking item counts. Historical evidence is preserved separately.

First review identified an overlap between the fullscreen fallback notice and first-time hint, plus a regeneration focus race: an already-focused host did not fire a focus event after renderer remount. Both were corrected in one batch. The mechanical design detector reported only an existing gold entry-button border treatment outside the changed HUD.


Final confirmation: PASS. `npm run typecheck` and `npm run build` passed. `BASE_URL=http://127.0.0.1:3002 GATHER_EVIDENCE_PREFIX=docs/milestones/evidence/m2-hud-gather npx playwright test tests/e2e/compact-hud.spec.ts tests/e2e/gathering.spec.ts tests/e2e/gameplay.spec.ts` passed all eight tests in 45.7 seconds. The dedicated HUD test verifies hidden slots, one-time hint persistence across reload, +3 berry feedback, I/button/Escape behavior, paused input in inventory, restored movement, and menu control lookup. Existing real two-context gathering/reload, collision, camera, fullscreen, remount and deterministic-rendering regressions passed.

Visual confirmation at 1280×800 and 800×600 (Chromium 153, local production build): [play](evidence/m2-hud-play.png), [satchel](evidence/m2-hud-satchel.png), [smaller window](evidence/m2-hud-small.png). Agent-browser entry verification reported no errors. The full simulation test suite and eight-player soak were not repeated for this UI-only refinement; multiplayer gathering was exercised with two separately authenticated contexts. Hosted browser gameplay was not rerun for this refinement. Browser preference storage can be unavailable, in which case the controls hint can appear again after remount. No gameplay saving or M3 work was introduced.
