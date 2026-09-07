# Player quality of life — M6

User-authorized on 2026-09-07. This is an incremental M6 update; M7 remains out of scope.

## Play

- The upper-right minimap covers all 128 × 128 tiles. Gold marks you; blue marks other online members. Click the map to expand the player list without covering gameplay.
- Select **Join** beside a player to teleport to a free nearby tile. A three-second cooldown, live target, combat restrictions and reachable terrain checks apply. A closed Forest gate cannot be skipped.
- Hold **V** with WASD/arrows to run at 1.75× walking speed. Diagonal speed remains normalized and collision uses the existing swept movement. Shift remains dodge. V avoids browser shortcuts such as Ctrl+W.
- Campfires illuminate and cast local shadows in addition to sunlight.

## Implementation decisions

`app/world-map.tsx` paints deterministic terrain once per seed, then overlays the small online roster. The roster is independent of the 48-tile 3D actor interest radius. Existing M6 world IDs and saved progress are preserved; an optional hello capability enables the extra roster field only for new clients. The UI updates at 10 Hz.

Run uses bit 16 in the existing validated movement mask and the shared prediction/authoritative transition. Combat actions keep their existing speed rules. No stamina system was added.

Teleport is a pure transition in `packages/simulation/travel.ts`, carried by the existing sequenced command envelope. The server selects the destination using a bounded reachable-tile search, rejects occupied/blocked landings, and accepts only a target member ID. Position, receipt and private cooldown enter the same durable aggregate; duplicate commands cannot move twice. This is fast travel to an online friend, not arbitrary map travel.

Input flush is 25 ms (previously 50), snapshot scheduling 50 ms (previously 100), and remote interpolation four ticks/~67 ms (previously nine/~150). The simulation remains 60 Hz. Message limits were adjusted while keeping input frame credits, validation, idle heartbeat and the durable publication barrier. Network use increases; actual delivery still depends on database and network latency.

The nearest campfire uses one pooled point-light shadow with 256 × 256 cube faces refreshed up to 20 Hz. The second pooled fire light illuminates without shadows. The existing main sunlight shadow remains. This bounds additional GPU work while allowing each campfire to cast shadows as the player approaches. Shadow resources are disposed with the scene.

## Verification

Local URL: https://astraworld.localhost:1355/ using Portless, two gateway processes, Redis and PostgreSQL.

- TypeScript check and optimized Next.js build passed.
- All 74 Vitest tests passed with real local PostgreSQL, including durable networking, rule/recovery tests, normalized running, teleport duplicate/cooldown/unknown target checks and closed-gate rejection. [Results](evidence/qol-tests.json), [integration recovery](evidence/qol-integration.json).
- Two independent browser contexts verified a run beyond 50 tiles, roster visibility outside actor interest range, safe teleport, peer propagation, cooldown and reload continuity. One active campfire shadow light and frame times were measured; no page errors. [Results](evidence/qol-browser.json), [map](evidence/qol-map.png), [camp](evidence/qol-camp.png).
- Final QoL run measured 56 tiles in eight seconds, a 115 ms locally confirmed teleport and 16.7 ms p95 frame time across the sampled two-context run. Opening the player list was visually reviewed without the pause overlay.
- Eight-player local browser regression passed movement, facing, waves, appearance, ninth-member rejection and identity resume across two gateways. [Results](evidence/qol-eight.json).

- Full two-player adventure regression passed gathering, combat, taming, interrupted dissolution and shared Forest entry. [Results](evidence/qol-slice-browser.json). All three Playwright scenarios passed in 2.5 minutes.

## Limits and next step

This update is locally verified, not deployed. The browser reload check covers session continuity; the existing database recovery suite passed, but a teleport-specific provider restore drill was not run. Local timing is not a hosted latency guarantee. The whole-map image shows generated terrain rather than dynamic resource depletion or gate artwork. Only the nearest fire casts additional shadows at a time.

Existing M6 release prerequisites (provider restore/retention evidence and inherited broader playtest/performance limits) remain as recorded in the M6 completion documents. No M7 work was added.

### Appearance picker polish

Removed visible preset character names and symbols from the entry picker so portraits represent appearance and the player supplies their own name. Radio labels remain available to assistive technology. Verified portrait selection and the selected checkmark in the local browser; TypeScript passed.

### Dodge roll

Dodge now rotates the character one full turn around a torso pivot, with tucked limbs and a compressed silhouette, facing the authoritative dodge direction. Its existing 15-tick duration, travel, collision, invulnerability and cooldown remain unchanged. Both local prediction and remote actors derive the pose from existing combat timestamps; no new network messages or simulation rules. Reduced-motion mode keeps the tuck without spinning.

TypeScript and nine focused renderer/combat tests passed. A two-context browser check sampled actual local and peer rig rotation through more than half a turn and back to upright, with no page errors. [Browser evidence](evidence/qol-roll.json), [rendered roll](evidence/qol-roll.png). The check uses the local Portless server; this polish is not deployed.
