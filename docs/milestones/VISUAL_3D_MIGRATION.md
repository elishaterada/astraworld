# Visual migration before M2 — 2026-09-07

**PASS within the recorded local test envelope. M2 remains unstarted.**

User-authorized scope: replace the sprite production workflow with original modular Three.js visuals inspired by Minecraft Dungeons. M2 remains unstarted. Base revision `15b33f2`; implementation and evidence are in the commit containing this document.

## Implemented

- Fixed 45-degree elevated orthographic Meadow, instanced block terrain, layered trees, mossy rocks, small grass/flower details, warm sunlight and PCF shadows.
- Fern, Ember, Iris and Hazel have separate hair/clothing/accessory geometry and use one shared limb rig. All eight facing directions rotate real geometry; walk and wave animate actual limbs. Reduced motion disables gait/bob and holds a static wave pose.
- Entry portraits use the same models, and the menu backdrop is a native capture of the new 3D Meadow. Username/fullscreen, invitations, eight members, session resume and server-owned motion remain. Keyboard directions stay screen-aligned; the ground projection and inverse pointer transform use the same camera constants.
- Pure generation, collision, prediction, server, Redis and protocol code remain unchanged. No new cloud services, dependencies on 3D physics, world height rules, inventory or other M2 features.
- Removed PixiJS and the unused runtime sprite adapter. Historical generated assets and evidence remain available in Git/repository. UI explicitly labels provisional 3D art.

[D027 decision](../decisions/DECISIONS.md), [rendering contract](../RENDERING.md), [art direction](../ART_DIRECTION.md).

## Verification

Local environment: Apple M4 Pro, macOS Darwin 25.6.0; production Next.js frontend on port 3002, Redis 6380, real gateway processes 3103/3104. Chromium 153.0.8010.12 with ANGLE Metal; desktop viewports 1440×900 and 1280×800. DPR capped at 1.5 (tests use device scale 1).

- `npm run typecheck`: PASS.
- `npm test`: PASS, 37 tests / 12 files. New tests compare screen/pointer math with actual Three.js projections across three viewport sizes/map positions, verify all eight facing directions against model forward vectors, and inspect real limb motion/reduced-motion/static wave behavior.
- `npm run build`: PASS, optimized Next.js build.
- Nine browser scenarios: PASS in 1.1 minutes. Four models walking/turning/stopping/waving; four distinct nonempty selector portraits; real invitation/copy/join and resume; eight independent players, ninth rejected, synchronized looks/rotation/actions; solo cardinal/normalized diagonal motion and collision/edge sliding; pointer/resize/focus; twelve unmount/remounts and four rapid restarts; deterministic rendered seeds; visibility; username/native-fullscreen/fallback.
- Inspected actual entry, gameplay and multiplayer screenshots. No page exceptions or renderer errors. Initial visual pass reported a deprecated shadow mode; replaced it with the current PCF mode before acceptance tests.

Evidence: [four-model directions](evidence/visual-3d-directions.json), [selector](evidence/visual-3d-character-selector.png), [shared play](evidence/visual-3d-character-gameplay.png), [eight players](evidence/visual-3d-eight.json), [eight-player screenshot](evidence/visual-3d-eight.png), [movement/camera](evidence/visual-3d-regression-browser.json), [lifetime](evidence/visual-3d-regression-lifecycle.json). Established test runners' historical output files were restored after copying new results into this migration's evidence paths.

Final verification after the frame-loop cleanup and label/menu adjustments: all six solo regression scenarios and both real-client network scenarios passed in 56.0 seconds. These cover 0/300 ms added application RTT, a dropped wave message and a five-second application outage/recovery; this is not a new TCP-loss test. [Normal network](evidence/visual-3d-network-0.json), [delayed network](evidence/visual-3d-network-150.json), [final entry](evidence/visual-3d-final-entry.png), [final gameplay](evidence/visual-3d-final-gameplay.png).

## Focused rendering measurement

`BASE_URL=http://127.0.0.1:3002 VISUAL_3D_PERF=1 EIGHT_EVIDENCE_PREFIX=docs/milestones/evidence/visual-3d-eight npx playwright test tests/e2e/eight-players.spec.ts` runs a separate 60-second traversal of eight real clients. [Measurements](evidence/visual-3d-performance.json). Clean run: 60.975 seconds; p95 frame interval 16.7–16.8 ms across all eight clients, maximum observed 33.4 ms. Retained heap growth 0.14–0.58 MiB. Each client retained seven peers with no sampled collisions; each renderer reported two geometries and three internal shadow textures at the end. This is a focused one-minute check, not a ten-minute stability claim.

The first measurement met frame/heap checks, but the enclosing test then incorrectly continued its spawn-based movement assertions after the traversal had moved players elsewhere. That harness failed with a negative displacement relative to original spawn. Its measurements are preserved in [first attempt](evidence/visual-3d-performance-first.json). The focused mode now returns after its own assertions, matching the established separate-soak pattern; ordinary capacity/motion/resume checks remain unchanged and passed independently.

## Limits and next work

These are original geometric placeholder models, not a claim to match the production art quality of Minecraft Dungeons. Meadow retains the original finite map and regular connected lane layout. Visual height does not enable climbing, slopes or jumping. Camera rotation, voxel editing and 3D physics are absent. The supplied concept remains style context only.

Safari/Firefox, low-end/mobile GPUs and high-DPR performance are unverified. M1's earlier ten-minute PixiJS and hosted TCP-loss results are historical; they are not new-renderer performance evidence. No server/network mechanism changed in this migration. Wider production device testing and final art approval remain separate from this bounded visual reference.

Launch the normal local services from README and open http://127.0.0.1:3002. Choose a name/look and Enter Meadow. WASD/arrows move, pointer aims, Space waves, Menu exposes the private invite, and Escape pauses input. Offline review is `/?solo=1`. The next eligible gameplay milestone is M2 only when requested.
