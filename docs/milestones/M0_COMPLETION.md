# M0 — engine sandbox completion evidence

Historical baseline. The subsequent [style/fullscreen refinement](M0_STYLE_UPDATE.md) has separate evidence and supersedes the old art, entry flow and playfield dimensions below.

Date: 2026-09-06. Scope: local M0 only. **PASS: G0, R0, R1 and the ten-minute local performance envelope. M0 complete.** No M1 work was started.

## Delivered

A Next.js/PixiJS top-down Meadow sandbox with deterministic finite terrain, keyboard movement, diagonal normalization, swept collision, a following camera, resize/focus handling and clearly labeled placeholder art. Pure world and simulation modules do not import React, PixiJS, browser, networking or storage APIs. The browser harness is temporary local authority; it is not a multiplayer implementation.

Tree and rock shapes are collision placeholders, not gatherable resources. No inventory, gathering, combat, crafting, taming, building, persistence, authentication, sockets, cloud resources or deployment were introduced.

## Checkout and environment

The supplied folder was initially documentation-only and entirely untracked within the parent Git root `/Users/elishaterada/repos`; that parent has no commits. Therefore no honest commit SHA can identify this result. No unrelated repository files outside `astraworld` were edited, staged or committed. The [SHA-256 source manifest](evidence/m0-source-sha256.txt) identifies the final code, tooling and tests.

Reference device: MacBook Pro (Mac16,8), Apple M4 Pro, 12 CPU cores, 24 GB RAM; macOS 26.6.2. Node 24.13.0 / npm 11.6.2. Chrome for Testing 153.0.8010.12, desktop headless Chromium using the Metal ANGLE backend, viewport 1440×900, DPR 1. The initial playfield is 1358×574 CSS pixels. This is a local machine reference, not a claim about all devices or browsers. Other desktop work and a short second browser suite overlapped the beginning of the measurement.

Dependencies are pinned in `package.json` and `package-lock.json`: Next 16.3.4, React/React DOM 19.2.8, PixiJS 8.20.1, TypeScript 5.9.3, Vitest 5.0.0, Playwright 1.63.0, agent-browser 0.36.0, Prettier 3.6.2. No runtime credentials, remote assets or services are required.

## Executed checks

| Check | Result / evidence |
| --- | --- |
| `npm run typecheck` | PASS, strict TypeScript |
| `npm test` | PASS, 10 tests across 2 files |
| `npm run build` | PASS, Next.js production build; `/` is statically prerendered |
| `npm audit --omit=dev` | PASS, zero known production dependency vulnerabilities at execution |
| agent-browser against local dev server | PASS, page and canvas rendered; controls present; no browser errors or Next error overlay; screenshot visually inspected |
| `BASE_URL=http://127.0.0.1:3001 npm run test:browser` | PASS, four production-browser scenarios (R0, R1, G0 seed UI, visibility handler); ten-minute test is intentionally skipped in the ordinary suite |
| `BASE_URL=http://127.0.0.1:3001 npm run test:soak` | PASS, 600.657 seconds; p95 16.7 ms; see performance section |

### G0 — reproducibility

100 seeds (`seed-0` through `seed-99`), 64 chunks per world, three request orders (forward/reverse/permuted). SHA-256 comparisons of assembled terrain/blocker/ID data matched. Every world had 16,384 unique tile IDs and every non-solid cell was reachable from the safe spawn. Different seeds differ. Invalid chunk coordinates are rejected. Unicode seed normalization is tested, including a surrogate pair split by the input length limit.

Full baseline residency is intentional at M0. No resource minimums, gate graph, mutable overlays or runtime chunk activation are claimed. A fixed reference SHA-256 locks the default `meadow-1` / `placeholder-1` baseline. Browser canvas comparisons also confirm same-seed image equality, different-seed variation and respawn after regeneration.

### R0 — movement, collision and camera

Rules tests verify four tiles/second, normalized diagonal speed, bounded/finite input, exact blocker-face stops, wall sliding, all diagonal corner directions, finite map boundaries, camera round-trips and display interpolation near corners. Twelve seeded deterministic walks (6,000 ticks each) never penetrated a solid tile or exceeded the per-tick displacement bound.

Actual browser keyboard events moved the rendered actor through the world. The recorded one-second straight and diagonal walks were both approximately four tiles. A longer diagonal walk crossed multiple props without penetration. A westward walk stopped at x=1.24; diagonal input against the west wall held that x while advancing south. Resize to 960×720 preserved actor centering and the pointer-to-world transform. Focus transfer to the seed textbox froze movement, releasing/reacquiring focus did not retain a held key, and Escape paused the game. See [browser measurements](evidence/m0-browser.json) and [the inspected gameplay screenshot](evidence/m0-gameplay.png).

A synthetic `visibilitychange` test verifies input clearing, tick suspension, paused return and explicit resume. A separate headed tab-switch probe did **not** create a hidden document in this automation environment: its targets remained visible. Thus real tab visibility transitions are unverified; [the probe output](evidence/m0-tab-focus.json) is a limitation, not passing evidence. Host blur and Escape used real browser input/focus events.

Visual inspection found a distinct player silhouette, readable trails/props, no canvas stretching after resize and a visible placeholder label. Art is deliberately simple and grid-arranged; this is not approval of final aesthetics.

### R1 — renderer lifetime

Twelve real Leave/Enter cycles and four rapid restart/unmount cycles completed without page errors or duplicate canvases. Each mounted sample had exactly one application, one ticker, one ResizeObserver, eight input/focus/pointer listeners and 66 owned textures. Unmount removed the canvas and diagnostic projection. Forced-GC JS heap samples stayed within the 8 MiB growth bound and fluctuated rather than growing every cycle. See [raw lifecycle measurements](evidence/m0-lifecycle.json).

These checks combine browser-visible behavior, owned-resource counts and JS heap sampling. They do not constitute a full GPU-memory profiler trace or a proof that every browser driver releases memory immediately.

## Ten-minute performance run

PASS. [Raw measurements](evidence/m0-performance.json): **600.657 seconds, 35,920 frames, mean 16.666 ms, p95 16.7 ms, maximum 16.8 ms, zero intervals over 20 ms**. Minute-by-minute post-GC heaps were 12.33, 12.57, 12.68, 12.37, 12.36 and 12.52 MB (decimal). All sixty sampled positions were collision-free and active; no browser errors occurred. Visible props ranged from 134 to 186 at the sampled positions.

The production bundle measured here contains the final movement/rendering behavior. During the soak, the only runtime-source change was sanitizing malformed Unicode seeds; the measured ASCII seed and its baseline hash are unchanged. Formatting and tests/docs were also updated. The final production build and browser suite were rerun after those changes; a second ten-minute run was not needed for that input-only fix.

The repeatable scenario holds D/A/W/S in alternating ten-second legs through the connected central trails, for sixty legs. It records real frame intervals after a two-second warm-up, collision/position/resource snapshots every ten seconds, and forced-GC JS heap samples every minute. The fixed map has 16,384 terrain tiles, 2,924 collidable prop sprites and one actor; only visible chunk/prop sprites render. The acceptance target is p95 frame interval ≤20 ms, over 30,000 measured frames, no collision violations, no browser errors and bounded post-warm-up heap growth.

Server CPU budgets, network latency/loss, Redis operations, permission tests and multiplayer recovery are not applicable to M0 and remain unverified.

## Launch / play / stop line

From `~/repos/astraworld`, run `npm ci` then `npm run dev` and open [localhost](http://127.0.0.1:3000). Click the Meadow (or Tab into it), move with WASD/arrows, pause with Escape. Edit the seed and use ↻ to regenerate/restart. Leave/Enter also restarts. No progress is saved. For production locally, run `npm run build` then `npm start`; use `-- --port 3001` if the dev server occupies port 3000.

The approved promo is still unavailable; the avatar has a single static placeholder pose. Safari/Firefox, real tab visibility transitions, hardware DPR changes without reload, low-end hardware and production hosting are not verified. Local preview deployment is pending/out of scope and does not block M0. No cloud infrastructure was provisioned.

Next eligible task: **M1 authoritative multiplayer**, only after a separate request, using its mission brief and server lifecycle/ownership experiment. Stop here.
