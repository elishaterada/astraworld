# Living Meadow environment — 2026-09-07

**PASS within the recorded local desktop test envelope. M2 remains unstarted.**

User requested a fuller Meadow with lighting, mist, ponds, bonfires and natural detail, before M2. Base commit: `044a005`. The two supplied Minecraft Dungeons screenshots are atmosphere references: cool wooded shade, warm firelight, haze, dense ground cover and readable block silhouettes. Their mobs, combat, treasure and cages are not instructions or implemented content. No third-party game assets are used at runtime.

## Environment contract

`packages/world/landmarks.ts` supplies six irregular pond definitions and four camp clearings. Seed-derived variation keeps them reproducible. Two overlapping ellipses shape each pond; water occupies solid full-tile footprints with a walkable shore. Campfire tiles and log seats are solid; fire has no damage, healing or interaction. Existing cardinal trails, the spawn clearing and eight spawn slots stay clear. Tree/log/rock placement clears a margin around shorelines and camps. All non-solid cells remain reachable in the 100-seed generation test.

The changed collision baseline is `meadow-2 / environment-1`. Active rooms use `p8-c4-env1`, including separate local/production/preview namespaces and a new tab-session key. Hello validation rejects old generation/content pairs. Refresh, create a fresh Meadow and send a new invite after this update. Old temporary rooms are not migrated and old invitations cannot enter the new landscape. No durable saves exist to migrate.

The pure simulation and server-owned movement rules are unchanged. New environmental footprints go through the same shared generator and swept collision as trees and rocks; clients cannot author ponds or fire pits.

## Presentation

- Cooler green foliage, denser layered crowns, varied wildflowers, shrubs, mushrooms, ground grass, reeds, cattails, lily pads and fallen logs.
- Water surface highlights animate in a small material shader. Water is shallow-looking scenery with solid banks, not a swimming or elevation system.
- A warm directional sun with PCF shadows, cool hemisphere fill and depth fog. Two pooled point lights illuminate the nearest bonfires without adding per-fire shadow passes or changing the shader's light count as the camera moves.
- Four stone-ring fires with glowing flame geometry, subtle light flicker, ground glow, rising sparks and soft smoke. Pond mist uses soft transparent planes. A fixed budget of 160 particles covers sparks and drifting motes; motes anchor in world space with wrapping outside the local view.
- Reduced motion holds water, foliage, mist, smoke, flame flicker and particles at a static phase; the existing readable static wave gesture remains. Hidden pages stop rendering. Effects are cosmetic; their clock never changes shared gameplay state.
- Willow Pond and Wayfarer’s Rest receive unobtrusive location subtitles. The first pond is northwest of spawn; the first camp is southeast. All four character designs and multiplayer gestures remain.

Resources are disposed with the view: effect geometries, shader/basic materials, point lights and scene objects, as well as the existing instance buffers, model kit, shadow targets, network connection and DOM listeners. Mist and water are stylized approximations, not volumetric fluid simulation, reflections or a weather system.

## Verification

Recorded environment: Apple M4 Pro, macOS Darwin 25.6.0, Chromium 153.0.8010.12 with ANGLE Metal. Production-mode frontend on port 3002; separate local gateways 3103/3104 and Redis 6380. No new service or package dependency.

- TypeScript and optimized Next.js build: PASS.
- 39 rule/integration tests in 13 files: PASS (16.41 seconds). Covers deterministic chunk order/IDs and complete walkable reachability across 100 seeds, plus pond bank collision, solid fire/log footprints, safe spawns/main paths across 30 seeds and rejection of a previously valid old-world hello. The new baseline hash is pinned; the former baseline and its evidence remain in Git history.
- Seven browser regression scenarios: PASS (58.1 seconds). Eight independent players, ninth rejection, shared facing/waves/appearance, full-room resume, normalized movement and boundary collision, resize/pointer/focus, twelve remounts and four rapid restarts, deterministic rendering under reduced motion, visibility handling, username gate and fullscreen/fallback.
- Browser screenshots and console review: actual world renders with ponds, campfire lighting and vegetation; no shader compilation or page errors observed.

The landmark test initially sampled the wave immediately after key input, before the render frame applied it. It now waits for the actual rendered gesture; both landmark and reduced-motion checks passed after this harness correction. No runtime change was needed for that assertion. Final landmark and performance measurements are linked below. Earlier M1/PixiJS and initial 3D performance evidence is historical, not a measurement of this effects pass.

Evidence: [eight-player capacity and synchronization](evidence/living-meadow-eight.json), [pond/camp authority](evidence/living-meadow-browser.json), [pond screenshot](evidence/living-meadow-pond.png), [camp screenshot](evidence/living-meadow-camp.png), [overview](evidence/living-meadow-overview.png), [performance](evidence/living-meadow-performance.json). The menu backdrop `public/art/meadow-living-v1.png` is an unedited native canvas export of this original scene, with no UI or third-party artwork baked in.

Final effects check: all three focused browser scenarios passed in 1.6 minutes, including the eight-client performance mode and both landmark/reduced-motion tests. The eight-client traversal lasted **61.040 seconds** at 1280×800 per browser: p95 frame interval **16.7–16.8 ms**, maximum observed **33.4 ms**, retained heap growth **0.08–0.53 MiB/client**. All retained seven peers with no sampled collisions. Each renderer reported five geometries and three internal shadow textures. This is a one-minute load sample, not a ten-minute soak or broad device guarantee. The final subsequent changes only refresh the entry backdrop and correct a diagnostic instance counter.

[Movement/camera evidence](evidence/living-meadow-regression-browser.json), [lifetime evidence](evidence/living-meadow-regression-lifecycle.json). Historical test output files were restored after copying results to this environment pass's paths.

## Scope and limitations

This completes the requested environmental reference within the recorded desktop test envelope. It remains original provisional art and a temporary cooperative session. No swimming, damage/healing from fire, gathering, inventory, combat, crafting, taming, buildings, persistent edits, changing weather or day/night rules. M2 has not started. Safari/Firefox, low-end GPUs, mobile and high-DPR performance remain unverified. Foliage motion is subtle and its shadow geometry stays static; mist uses layered planes, and water has stylized highlights rather than scene reflections.
