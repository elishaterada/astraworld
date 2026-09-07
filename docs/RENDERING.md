# Rendering contract — Three.js visual migration

The user authorized this replacement on 2026-09-07 before M2. Historical PixiJS implementation notes below are superseded for presentation; M1 network authority and recovery contracts remain current.

## Ownership and coordinates

React owns entry, fullscreen, menus and low-frequency status. Dynamically imported `app/renderer.ts` owns browser input and the frame loop. `app/three/view.ts` consumes read-only local/remote projections. Simulation remains pure, flat and server-owned: tile `(x,y)` maps to Three.js `(x,0,y)`. Height is cosmetic. Existing world IDs, generation, full-tile blockers, body size and eight-player protocol are unchanged.

The orthographic camera is elevated 45 degrees from the south and follows the rendered feet position. East stays screen-right and south stays screen-down; WASD retains its established meaning. Scale is 48 CSS pixels/world unit horizontally. Ground depth compresses by sin(45°). `app/camera.ts` owns the inverse pointer transform; tests compare it against actual Three.js projection after resize and at map edges. Facing rotates the model through all eight protocol directions, without mirrored accessories.

## Assets and rendering

Three.js 0.185.1 and types 0.185.4 are pinned. No React Three Fiber or physics engine is needed. Each 16×16 chunk batches ground, solid props/details and leaves into three instanced cube meshes with per-instance colors. Seeded tile variants drive cosmetic dimensions/colors only. Mossy bases show full-tile collision footprints. Nearby foliage dithers where it obscures the local character; this is a visual shader, never a collision change. Off-camera chunks are culled with a shadow margin. A hemisphere light and one PCF directional shadow provide warmth and depth; DPR is capped at 1.5. There is no postprocessing pipeline.

One box geometry and a per-view material palette build four original characters with distinct hair, clothing and accessories. Shared shoulder/hip pivots animate walking and an actual raised-arm wave. Reduced motion keeps legs and body still and holds a static raised arm for waves. Name markers remain; remote labels are bounded DOM projections, written as text. Character choice remains cosmetic and non-exclusive.

Entry portraits render the same models once into 2D previews and immediately dispose their temporary WebGL contexts. Gameplay does not load sprite sheets. Historical assets and provenance remain archived; PixiJS and the unused sprite adapter are removed.

## Lifetime and evidence

Disposal cancels animation, clears all registered input listeners, disconnects ResizeObserver and the network client, removes labels/canvas, and disposes instance buffers, geometries, materials, shadow targets and WebGL renderer/context. Hidden pages stop drawing and clear input; visible shared peers still animate while the local menu pauses input. Read-only debug snapshots expose actual limb rotation, renderer resource/draw statistics and bounded frame measurements; no state setters are exposed.

See [verification and limitations](milestones/VISUAL_3D_MIGRATION.md). Earlier PixiJS ten-minute performance results are historical evidence, not measurements of the new renderer. Reference APIs: [orthographic camera](https://threejs.org/docs/pages/OrthographicCamera.html), [instancing](https://threejs.org/docs/pages/InstancedMesh.html), [resource disposal](https://threejs.org/manual/en/cleanup.html).

---

## Historical PixiJS contracts (superseded presentation)

# Rendering contract

**Current M1 implementation:** [protocol 2 responsiveness contract](milestones/M1_RESPONSIVENESS.md). It supersedes the earlier 20 Hz prediction / per-tick Redis / 45-second rotation reference. Broader future-system proposals below remain outside M1.

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

`packages/characters` defines four cosmetic identities and symbols without simulation statistics. Fern and Ember are male adventurers; Iris and Hazel are female adventurers. Each has its own nine-frame RGBA sheet in `public/art/*-v1.png`, indexed by `characters-v1.json`. The selector draws the same front-standing crop without recoloring. Local and remote sprites use the identity stored by the server, selecting front/back/right rows and mirroring right for left. The gait remains `[stand, step A, stand, step B]` at 8 Hz; reduced motion selects the standing pose. Each direction's standing height normalizes the sheet to 48 screen pixels; all frames anchor at their feet. Four atlas loads run concurrently, cached per page; React never owns animation ticks. Name markers remain circle/diamond/star/square. Looks are cosmetic and not exclusive. See [art update](milestones/M1_CHARACTER_ART.md).

An existing tab session offers Resume Meadow and locks the name/look to the stored identity. Leave Meadow clears the tab's resume capability so a new world can start with another choice. An invitation takes priority over the old tab session. The shared menu has Copy invite link with clipboard-failure text and a selectable input fallback. Fullscreen remains requested from the entry submit gesture. No movement or collision rules changed.

## Living Meadow follow-up — 2026-09-07

[Environment contract and evidence](milestones/LIVING_MEADOW.md) supersedes the migration's simple scenery: four instanced categories per chunk (ground, water, props, leaves), richer vegetation, depth fog, water/foliage material animation and `app/three/atmosphere.ts` for bounded mist, smoke, sparks, glowing bonfires and two pooled point lights. The read-only debug `environment` projection reports effect phase/counts. Reduced motion freezes cosmetic time; hidden documents stop drawing. All effect resources dispose with the view. The new world collision version is an explicit environment decision, not a rendering-side alteration to server state.

## M2 resource presentation

Original modular berry bushes carry pink fruit cubes; a gold ring marks the nearest resource within interaction range. E animates the right arm immediately; a hatchet appears for tree chopping and confirmed gather gestures reach observers. Harvested tree crown/trunk instances are zero-scaled once, leaving a solid mossy stump. Bush fruit instances disappear once. Shared geometry/materials and instance buffers are disposed with the world; no sprite generation or per-resource React component is used. The low-frequency HUD displays only committed inventory.

## Compact game HUD (M2 refinement)

The satchel is hidden by default. Its bottom-right button or I opens a native dialog with the 12 slots; I, Escape or Close returns focus to the playfield. The dialog pauses local input while the shared world continues. Escape from gameplay opens the existing pause menu, which now contains a Controls reference. An already-focused playfield explicitly resumes when its renderer is regenerated.

The permanent movement strip and verbose session/art footer are removed from gameplay. A first-play hint dismisses manually or after ten active seconds and records only a browser-local controls preference; disabled storage falls back to showing it again on a later mount. Nearby resources get a small E prompt below the player. Confirmed gains/rejections appear for three seconds; fullscreen fallback notices appear near the fullscreen button for five seconds. The location and party count remain compact, while connection problems stay visible. Placeholder-art and temporary-recovery labels remain in entry/menu UI. This adds no M3 mechanics or gameplay persistence.
