# Rendering contract

## Ownership

Next.js/React owns entry screens, session flow, inventory panels and settings. A client-only PixiJS canvas owns world sprites, terrain, camera and effects. React receives low-frequency UI state; do not run the simulation tick or every sprite position through React state.

PixiJS is a 2D rendering engine; its official [introduction](https://pixijs.com/8.x/guides/getting-started/intro) supports this role. The following design is a project proposal, not a library guarantee. Pin actual dependency versions at M0 after checking their current APIs.

## Render data flow

Authoritative/predicted state → read-only render projection → sprite registry keyed by entity ID → layer/depth ordering → canvas. Animation and particles cannot award damage or items. A visual event carries a stable event ID so duplicate snapshots cannot play a loot or tame celebration repeatedly.

Only the local player is predicted. Other actors interpolate between authoritative samples. Camera follows the rendered local position, and correction smoothing must not visually conceal a large invalid location for seconds.

## Coordinates and layers

Simulation uses continuous x/y tile units; tile (0,0) is the northwest map origin, x increases east and y south. Sprite pixel size is an adapter detail. Place each actor's anchor at its feet. Depth sort world objects by foot y, with stable entity ID tie breaking. Keep terrain below actors, canopy/foreground above, and interaction/health overlays separately readable.

Proposed layers: terrain → ground details → y-sorted props/actors → overhead foliage → effects → world labels. Fade occluding canopy when needed without changing collision. Define a single screen-to-world transform for mouse targeting that handles canvas scaling and camera zoom.

## Lifetime and performance

Load atlases once, reuse sprite instances and cull outside the camera margin. Mount/unmount must remove ticker callbacks, DOM listeners and graphics resources. Tab visibility changes stop unnecessary rendering; the server remains authoritative and ignores stale input. On return request resynchronization before prediction resumes.

Start with one camera and bounded zoom, nearest-neighbor sampling for pixel-art tests, capped device pixel ratio and integer-aligned visual sampling where feasible. Do not quantize simulation motion merely to align pixels. M0 must compare visual stability during slow movement and resize.

The target is 60 FPS on the recorded desktop reference device. [TESTING.md](TESTING.md) defines measurement conditions; this is a test target, not a claim of current performance. Defer dynamic lighting, shader-heavy weather, 2.5D conversion and elaborate postprocessing.

## Original M0 reference (historical; art and entry superseded below)

`app/sandbox.tsx` loads `app/renderer.ts` inside a client effect. PixiJS 8.20.1 is imported only in that dynamically loaded module. React holds low-frequency status (four updates/second) and mount/seed controls, never the movement loop.

The renderer uses a private ticker and 20 Hz fixed simulation with interpolation; the actor moves four tiles/second. The world-space collision body is a centered 0.48×0.48 tile AABB at the feet. Axis sweeps clamp against full-tile blocker faces and permit wall sliding. Interpolation follows the swept path when a straight blend would cut a solid corner. Tile graphics use 32 pixels/tile and nearest-neighbor textures; the camera follows continuous feet coordinates without quantizing simulation.

There are 64 baked 512×512 terrain textures, two shared prop textures and one vector avatar. Off-camera chunk sprites and props are hidden. The initial map is fully resident; this is rendering culling, not world streaming. Props are sorted by foot y; equal-depth static objects keep the baseline's stable coordinate/ID order. Nearby occluding tree canopies fade to 45% opacity. No effects, targeting actions, animation system or production atlas pipeline is introduced.

Camera position equals the interpolated actor position, including at map edges (the outside of the map uses a muted background). `app/camera.ts` owns reversible canvas/world transforms. ResizeObserver updates the drawing buffer and transform; device pixel ratio is capped at two. Changing monitor DPR without resizing/reloading is not separately handled.

The playfield owns keyboard events and is focusable by mouse or Tab. Blur, Escape and document visibility changes clear held input and accumulated time. Hidden documents stop the ticker; returning requires canvas focus/click to resume. Catch-up is bounded and pauses never replay old input. A single disposer removes eight input/focus/pointer listeners, the ResizeObserver and ticker, destroys the application/canvas and all 66 generated textures. Async initialization cancellation destroys its eventual application before mounting it. Strict Mode, twelve remounts and four rapid restarts have browser coverage.

M0 source art is code-authored geometric pixel-style placeholder art. No external artwork, fonts or asset downloads are required at runtime. `?debug=1` exposes a snapshot-only diagnostic projection (including a bounded frame interval buffer); it does not expose setters or gameplay commands. This is local test instrumentation, not an M1 protocol.


## Reference-driven visual and entry update — 2026-09-06

The earlier M0 renderer above is the historical baseline. Current rendering uses [the supplied reference](art-reference/early-game-concept.png) and the generated atlas described in [ART_DIRECTION](ART_DIRECTION.md). A single shared source texture and sixteen frame views are reused for the page lifetime. Each mounted renderer owns 64 terrain textures at 256×256 pixels, displayed at 512×512, replacing the former baked graphics. The private ticker, observer and nine renderer listeners (including fullscreenchange) are released on disposal; per-mount textures are destroyed, while the one shared atlas remains intentionally cached.

A username form precedes creation of the Pixi application. `app/profile.ts` normalizes and validates 2–20 letters/numbers with spaces, apostrophes, hyphens or underscores. The label is rendered by React as text above the camera-centered actor; it is neither an account nor a multiplayer identity and is never stored or sent to a server.

`Enter Meadow` calls `requestFullscreen()` on the persistent page shell during the submit gesture. Gameplay always occupies the entire browser viewport. A denied/unsupported fullscreen request leaves it playable with a dismissible explanation; the ⛶ control can retry. The `fullscreenchange` listener updates the control and pauses movement on exit. Leaving the Meadow exits native fullscreen and disposes the canvas. There is no keyboard lock: Escape remains available to the browser.

Menu uses a native modal dialog with focus containment. Opening it clears gameplay input through blur; closing restores canvas focus. Seed regeneration and leaving remain available inside Menu. The initial page is a real username form over a generated scenery backdrop, not a static screenshot UI.

Read [update evidence](milestones/M0_STYLE_UPDATE.md) for the new browser and performance measurements. The earlier 1358×574 playfield benchmark must not be presented as the current 1440×900 rendering load.

## M1 client rendering adapter

Ordinary play now uses `MeadowConnection` for predicted local position and a bounded remote snapshot buffer. The existing camera and collision-aware interpolation render the local actor. Nearby remote actors use the selected Fern, Ember or Iris tint on the same provisional atlas, with a matching symbol and name label, at approximately 100 ms interpolation delay. Remote gait animation and correction-specific visual easing are not implemented; large authoritative corrections may visibly snap. Terrain and simulation geometry remain unchanged. Offline M0 (`?solo=1`) keeps its original local-step path.

Network disposal accompanies renderer disposal. Hidden pages clear input and stop the Pixi ticker; the server independently expires movement after 250 ms and visible presence after three seconds. The shared world continues when a player's menu is open. A responsive connection status remains visible at narrow desktop widths.


## M1 character selector

`packages/characters` defines three cosmetic colorways and symbols; these have no simulation statistics. The entry form uses native radio controls with visible selection and keyboard focus. Canvas portraits multiply the same atlas frame's RGB channels by the same tint as Pixi; no second character-art source is introduced. These are clearly labeled placeholder colorways. The renderer applies the choice to local gait frames and remote sprites. Names remain visible; circle/diamond/star markers distinguish looks beyond color alone. Choices are not exclusive within a room.

An existing tab session offers Resume Meadow and locks the name/look to the stored identity. Leave Meadow clears the tab's resume capability so a new world can start with another choice. An invitation takes priority over the old tab session. The shared menu has Copy invite link with clipboard-failure text and a selectable input fallback. Fullscreen remains requested from the entry submit gesture. No movement or collision rules changed.
