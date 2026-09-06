# M0 refinement — concept artwork and fullscreen entry

2026-09-06. Base revision: `0ea631f` (Initial commit). The [source and asset manifest](evidence/m0-style-source-sha256.txt) identifies this refinement; no commit or deployment was made. **PASS: style/entry refinement, six browser scenarios, and the updated ten-minute performance envelope.** This is a refinement of M0, not advancement to M1. The user's follow-up explicitly requested matching the supplied early concept and launching fullscreen after choosing a username.

## Result

The original geometric sprites and document-style frame have been replaced with a scenic username entry screen and an edge-to-edge game. New pixel-painted trees, rocks, wildflowers and an animated adventurer follow the supplied image's warm greens, ochre paths, teal shadows and storybook atmosphere. The original reference is archived under `docs/art-reference/`; exact generation prompts and the transparent atlas are project files.

Enter a local 2–20 character name and click **Enter Meadow**. That submit gesture requests native browser fullscreen. The game fills the viewport regardless of whether native fullscreen succeeds; a rejected/unavailable request shows a dismissible message and leaves play available. **⛶** toggles fullscreen, **Escape** pauses/releases focus, and **Menu** holds the world seed, restart, resume and Leave controls. Leaving returns to entry and exits fullscreen. Reload clears the name; there is no account, authentication or saving.

The image's “Wildermon” title and other feature panels were treated as visual context, not instructions to rename Astraworld or implement other systems. No gameplay mechanics, services, multiplayer, persistence or new biomes were added. `packages/world` and `packages/simulation` are unchanged from the baseline, including the golden generation hash.

## Visual implementation and provenance

- [Supplied reference](../art-reference/early-game-concept.png): copied unchanged from the user-provided PNG and inspected.
- [Exact built-in image-generation prompts](../art-reference/asset-prompts.json): one atlas generation, one targeted alpha-background correction, one scenery backdrop generation. No CLI/API-key generation workflow was used.
- `public/art/meadow-title-v1.png`: 1536×1024 backdrop, approximately 2.6 MiB.
- `public/art/meadow-atlas-v2.png`: 1272×1236 RGBA, approximately 1.1 MiB; 16 cropped frame views defined by metadata. The first draft's checkerboard was rejected; actual alpha was verified with image metadata and in-browser composition.
- `app/art.ts`: shared atlas loading plus deterministic cosmetic ground textures. Each renderer owns 64 textures at 256×256 pixels, displayed at 512×512. Source frames are cached for page lifetime. Ground pixels render at 2× scale; gameplay remains 32 pixels per world tile.
- Four tree variations, two rocks and two flower patches; eight poses of one player. Walking uses 8 Hz pose changes, mirrored left-facing art and static poses under reduced motion. Canopies covering the player fade to 22% so movement remains legible.

See [the entry screenshot](evidence/m0-style-entry.png), [the initial game view](evidence/m0-style-first-game.png) and [actual traversal](evidence/m0-style-gameplay.png). These were visually inspected; the art remains a provisional study, especially the sparse animation set and regular M0 map layout.

## Checks

Environment: same MacBook Pro M4 Pro / 24 GB / macOS 26.6.2 as the baseline. Node 24.13.0, Next.js 16.3.4, PixiJS 8.20.1, Chrome for Testing 153.0.8010.12. Windowed browser tests and performance run use a 1440×900 viewport at DPR 1; the game now occupies all of it. Native fullscreen was separately verified at 1440×900. The production server was launched on 127.0.0.1:3002 because another local project occupied port 3000. An early dev-server check was interrupted when that process exited; subsequent acceptance checks use the stable production server.

| Check | Evidence |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 11 tests across 3 files passed, including username normalization and invalid input |
| `npm run build` | Production build passed |
| `BASE_URL=http://127.0.0.1:3002 npm run test:browser` | PASS: six scenarios; the separately invoked ten-minute test is intentionally skipped in the ordinary suite |
| `BASE_URL=http://127.0.0.1:3002 npm run test:soak` | PASS: 600.723 seconds, 35,925 frames, p95 16.7 ms; see below |
| Embedded browser via CUA | Username form, native fullscreen, rendered Meadow, focusable game, Menu, Leave, fullscreen exit and return to clean entry were verified in the app's actual in-app browser |

[Movement measurements](evidence/m0-style-browser.json): both straight and diagonal one-second walks measured four tiles. The west boundary stopped at x=1.24; diagonal wall sliding held x and advanced south. Resize to 960×720 kept the actor centered at (480,360). No browser errors were recorded in R0.

[Lifetime measurements](evidence/m0-style-lifecycle.json): each mounted instance had one application, one ticker, one observer, nine renderer listeners and 64 owned terrain textures; a single shared atlas with 16 frame views is intentionally cached. Twelve forced-GC heap samples ranged from 12.63 to 14.11 MB, within the 8 MiB growth bound. Canvas removal and rapid asynchronous remount cancellation passed. This is not a complete GPU-driver memory trace.

[Native fullscreen evidence](evidence/m0-style-fullscreen.json) confirms successful browser fullscreen with the entered display name. The fallback test deliberately rejects the fullscreen request and verifies an exact viewport-sized playable canvas. Blank/invalid names do not mount a canvas. The username test checks trimming, visible name, leaving and reload reset. The visibility test invokes the visibility event handler explicitly; the original limitation around automated real tab-visibility transitions still applies.

A test locator initially matched Next.js's route announcer alongside the username error, and the old visibility test clicked beneath the new pause panel. Those test selectors were corrected to use the specific validation element and the visible Resume button. No gameplay invariant was relaxed to make tests pass.

## Performance

The updated 1440×900 run **passed**. [Raw measurements](evidence/m0-style-performance.json): **600.723 seconds, 35,925 frames, mean 16.666 ms, p95 16.7 ms, max 16.8 ms, zero frame intervals over 20 ms**. All sixty sampled positions remained collision-free and active; no browser errors occurred. Minute-by-minute post-GC heaps were 12.95, 13.19, 13.29, 12.89, 12.88 and 13.04 MB (decimal), with no persistent growth. Visible props ranged from 272 to 335 at the sampled positions, versus the smaller original scene's 134–186.

The scenario alternates D/A/W/S in ten-second legs for ten minutes, using the production build, the default Meadow seed and the entered local name Rowan. Fullscreen is deliberately denied in this benchmark to hold the measured viewport fixed; native fullscreen is independently tested. This is the actual final runtime renderer; only tests/evidence/documentation changed while it ran. The original M0 benchmark remains historical evidence and was not reused for this larger scene.

## Limits and next task

This is a close stylistic translation into the existing M0 sandbox, not a reproduction of every feature or scene in the concept poster. The map remains the same finite Meadow with safe connected lanes and static blockers. Native fullscreen depends on browser support/permission; the fallback is intentional. Safari/Firefox, low-end hardware and production hosting remain unverified. Art and animation remain replaceable study assets.

The server remains local; nothing was deployed. Next eligible milestone is M1 only upon a separate request. This refinement stops at M0.
