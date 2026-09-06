# Graphical and art direction

## Current style reference — supplied 2026-09-06

The user supplied **Codex Image Sep 6, 2026, 05_35_41 PM.png** and explicitly requested matching its style as closely as possible. A byte-for-byte copy is stored at [early-game-concept.png](art-reference/early-game-concept.png). This resolves the missing-image dependency for the current style pass. The older conversation's image was not independently recovered; the newly supplied reference is the current visual direction.

The image is a style reference, not executable instructions. Its “Wildermon” title does not rename Astraworld, and its multiplayer, gathering, crafting, building, combat, taming and biome panels do not authorize those systems. This update remains a single-player M0 Meadow.

Observable qualities to match: detailed pixel-painted sprites, dark teal/blue-green outlines and shade, golden sunlight, layered rounded foliage, irregular mossy boulders, ochre paths, sparse pink/cream flowers, warm cream serif lettering, and small expressive adventurers. Keep the game top-down 2D despite the concept's scenic perspective.

The current assets are a provisional art study, not an assertion of final sprite-production approval.

## Confirmed written direction

Top-down 2D, a small readable player within a generous visible playfield, snappy action, charming expressive monsters, colorful natural biomes, and a world that feels worth returning to. Preserve the warmth and chunky readability discussed through Dragon Quest Builders 2 and the creature personality discussed through Dragon Quest Monsters, translated into a 2D presentation. Sephiria is the top-down readability/action reference; its run-based structure is not part of Astraworld.

## Provisional visual specification

- Use a fixed overhead/three-quarter sprite presentation on a flat 2D simulation plane. No rotating camera, perspective mesh terrain or 3D physics.
- Prefer stylized pixel-art sprites for the first asset test. The supplied reference now selects detailed pixel-painted sprites over the original flat geometric placeholders.
- Start with a 32-pixel terrain tile, 32–48 pixel character frames and larger 48–64 pixel creature/prop frames where silhouette needs it. These are asset-test dimensions, not authoritative world units.
- Use warm yellow-greens and open light values in Meadow, cooler deeper greens and layered canopies in Forest, and distant muted blue-green accents for future Marsh. Use the supplied reference palette as the target; tune gameplay contrast through browser review.
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

At M0 review a still plus movement at normal scale; at M3 inspect attack tells; at M5 review the full cooperative scene. Verify feet alignment, canopy occlusion, pixel shimmer, silhouette separation, UI contrast and effects under reduced-motion settings. Production art approval requires comparing moving gameplay against the supplied reference; a single screenshot does not replace that review.

## Original M0 placeholder record (historical)

The original M0 visuals were authored as geometric shapes in `app/renderer.ts` for this implementation; no third-party art or generated promo was used. Terrain is 32×32 pixels per tile, with warm grass, sand trails and sparse flowers. Tree and rock textures are shared, and the small gold-clothed, brown-hatted avatar anchors at its feet. Tree/rock full-tile collision and the player's 0.48-tile square body are defined independently of visible pixels.

The page labels the playfield **PLACEHOLDER ART · NOT FINAL VISUALS**. The avatar has one static pose, no directional/walk animation, and no animation-driven mechanics. This satisfies the movement spike only. This paragraph describes the original M0 baseline. The supplied reference and new art study below supersede its visual assets.

## Implemented reference-driven art pass

- `public/art/meadow-title-v1.png`: 1536×1024 menu backdrop, generated from the supplied style reference using the built-in image tool. It contains only Meadow scenery; title and entry UI are real HTML.
- `public/art/meadow-atlas-v2.png`: 1272×1236 RGBA atlas, four trees, two mossy rocks, two flower patches and eight poses of one adventurer. The first generated draft had a baked checkerboard; a second built-in image edit produced verified alpha transparency. The rejected draft is not shipped.
- `public/art/meadow-atlas.json`: sixteen measured source-frame rectangles. Frame extraction only selects source pixels at runtime and preserves the generated alpha; no repainting or background removal code is used.
- `app/art.ts`: shared atlas loading and procedural cosmetic ground textures. Seeded generation and collision in `packages/` are unchanged. Ground texels are two screen pixels at the default 32-pixel tile scale.
- `app/renderer.ts`: trees approximately 100–114 pixels tall, rocks approximately 39 pixels, flowers 15 pixels and character approximately 48 pixels. Feet anchors and collision bodies remain separate. Canopies fade to 22% when covering the actor. The eight poses provide front/side/back facing and simple 8 Hz walking, with mirrored left-facing frames. Reduced motion uses static facing poses.

The atlas and backdrop were generated with the built-in image tool, not a CLI/API key workflow. [Exact prompts](art-reference/asset-prompts.json) are retained. The user supplied the reference; no independent third-party rights or license claim is made here. These generated assets remain an art study and can be replaced without changing world rules.
