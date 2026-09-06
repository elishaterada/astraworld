# Graphical and art direction

## Reference status

The user approved a generated promo concept in “Plan Multiplayer Game” and then named the game Astraworld. The retrieved conversation contains that approval but **does not expose the generated image, its file, or its generation prompt**. This document preserves the accessible written direction; it cannot certify the image's exact palette, silhouettes, composition or rendering technique. Do not invent an image reference or claim a new image is the approved one.

Before final production assets, attach the original promo to the repository's future art-reference folder, record its provenance, inspect it and reconcile these provisional specifications. M0 can proceed with labeled placeholders. Recovering the image is an art-finalization dependency, not a blocker for movement and networking.

## Confirmed written direction

Top-down 2D, a small readable player within a generous visible playfield, snappy action, charming expressive monsters, colorful natural biomes, and a world that feels worth returning to. Preserve the warmth and chunky readability discussed through Dragon Quest Builders 2 and the creature personality discussed through Dragon Quest Monsters, translated into a 2D presentation. Sephiria is the top-down readability/action reference; its run-based structure is not part of Astraworld.

## Provisional visual specification

- Use a fixed overhead/three-quarter sprite presentation on a flat 2D simulation plane. No rotating camera, perspective mesh terrain or 3D physics.
- Prefer stylized pixel-art sprites for the first asset test. Pixel art versus smoothly painted sprites remains provisional until comparison with the approved image.
- Start with a 32-pixel terrain tile, 32–48 pixel character frames and larger 48–64 pixel creature/prop frames where silhouette needs it. These are asset-test dimensions, not authoritative world units.
- Use warm yellow-greens and open light values in Meadow, cooler deeper greens and layered canopies in Forest, and distant muted blue-green accents for future Marsh. Exact colors remain unapproved.
- Keep the player, enemies, companion and interaction targets distinct by shape, pose and outline as well as color. A friendly Slime needs an obvious non-hostile cue.
- Concentrate contrast around actors and attack tells. Reduce background texture frequency near play paths. Avoid heavy bloom, dense particles and realistic lighting that obscure collision.

## Required slice assets

| Group | Minimum set |
| --- | --- |
| Player | Idle, walk, attack, dodge, hurt and downed states; directional convention chosen at M0 |
| Slimes | Hostile and Moss variants; idle, move, telegraph, attack, hurt, tame response and utility |
| Terrain | Meadow base/variation, path, Forest base/edge, blocked boundary |
| Props | Tree, depleted tree/stump, berry bush with depleted variant, vine gate and opened state |
| Feedback | Hit, gathering, feed/trust, tame success, dissolve and Forest-entry cues |
| UI | Health, berry/wood icons, companion portrait/status, target and connection indicators |

Placeholder art must make every required state distinguishable even before polish. Do not generate a large asset pack before the first movement and creature reference works.

## Asset pipeline and review

Record creator/source, rights or license, dimensions, animation timings, anchor points, collision-footprint metadata and atlas membership. Use original characters and assets; references describe qualities, not copied designs. Keep collision authored in world units separately from opaque sprite pixels.

At M0 review a still plus movement at normal scale; at M3 inspect attack tells; at M5 review the full cooperative scene. Verify feet alignment, canopy occlusion, pixel shimmer, silhouette separation, UI contrast and effects under reduced-motion settings. Production art approval requires inspecting the original promo; screenshots of a placeholder prototype do not replace that comparison.

## M0 placeholder record

All current visuals were authored as geometric shapes in `app/renderer.ts` for this implementation; no third-party art or generated promo was used. Terrain is 32×32 pixels per tile, with warm grass, sand trails and sparse flowers. Tree and rock textures are shared, and the small gold-clothed, brown-hatted avatar anchors at its feet. Tree/rock full-tile collision and the player's 0.48-tile square body are defined independently of visible pixels.

The page labels the playfield **PLACEHOLDER ART · NOT FINAL VISUALS**. The avatar has one static pose, no directional/walk animation, and no animation-driven mechanics. This satisfies the movement spike only. The original promo is still required before production visual approval.
