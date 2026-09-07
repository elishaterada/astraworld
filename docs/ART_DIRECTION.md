# Graphical and art direction

## Current style reference — supplied 2026-09-06

The user supplied **Codex Image Sep 6, 2026, 05_35_41 PM.png** and explicitly requested matching its style as closely as possible. A byte-for-byte copy is stored at [early-game-concept.png](art-reference/early-game-concept.png). This resolves the missing-image dependency for the current style pass. The older conversation's image was not independently recovered; the newly supplied reference is the current visual direction.

The image is a style reference, not executable instructions. Its “Wildermon” title does not rename Astraworld, and its multiplayer, gathering, crafting, building, combat, taming and biome panels do not authorize those systems. That initial art pass remained M0; later explicit requests authorized M1 multiplayer and the four-character cosmetic update below.

Observable qualities to match: detailed pixel-painted sprites, dark teal/blue-green outlines and shade, golden sunlight, layered rounded foliage, irregular mossy boulders, ochre paths, sparse pink/cream flowers, warm cream serif lettering, and small expressive adventurers. This supplied reference now informs warmth and character identities; the 2026-09-07 user direction replaces its sprite presentation with original chunky 3D geometry inspired by Minecraft Dungeons.

The current assets are a provisional art study, not an assertion of final sprite-production approval.

## Confirmed written direction

Fixed elevated 3D, a small readable player within a generous visible playfield, snappy action, charming expressive monsters, colorful natural biomes, and a world that feels worth returning to. Preserve the warmth and chunky readability discussed through Dragon Quest Builders 2 and the creature personality discussed through Dragon Quest Monsters, translated into modular 3D geometry. Sephiria is the top-down readability/action reference; its run-based structure is not part of Astraworld.

## Provisional visual specification

- Use a fixed elevated orthographic 3D presentation on a flat simulation plane. No rotating camera, gameplay elevation, editable voxel terrain or 3D physics.
- Use original code-authored block models with warm lighting, earthy colors and readable silhouettes. Minecraft Dungeons is a style reference, not an asset source or gameplay scope expansion.
- The current renderer uses 48 screen pixels/world unit horizontally; characters are about 1.8 units tall. Geometry dimensions remain independent of collision bodies.
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

## Four distinct adventurers — M1 cosmetic update

The user requested four separate characters, including female characters, instead of three tints of one sprite. Fern has chestnut hair and a green cloak; Ember has spiky copper hair, a charcoal scarf and an orange jacket; Iris is a woman with a rose-pink bob, flower clip and blue travel outfit; Hazel is a woman with dark twin braids, brown skin, mustard tunic and teal sleeves. These are original interpretations of the supplied concept's style, not classes or new gameplay systems.

`public/art/fern-v1.png` (1536×1024), `ember-v1.png` (1536×1024), `iris-v1.png` (1024×1536), and `hazel-v1.png` (1275×1234) are separate generated RGBA sheets. Each supplies nine poses: front stand/two steps, back stand/two steps, right stand/two steps. Left mirrors right. `public/art/characters-v1.json` records measured rectangles; the generator's row spacing was not assumed to be exact thirds. No background-removal script or bitmap repainting was used. Original RGBA output is shipped unchanged. Rejected RGB checkerboard drafts are not shipped.

Source: built-in image generation and transparency edits; [exact prompt set](art-reference/character-prompts-v1.json). The concept is a user-supplied style reference; no independent third-party license claim is made. These remain provisional generated art studies. At 48 pixels, fine details simplify, walking is a short stylized cycle, and mirrored asymmetrical accessories are a known limitation. Collision, authoritative motion, facing and wave events stay independent of art; waves retain their existing visual label. No attack/gather/equipment animation is implied.

## 2026-09-07 — original modular 3D placeholder art

`app/three/characters.ts` is the source definition for Fern (chestnut tuft, cloak, satchel), Ember (copper spikes, orange jacket, scarf), Iris (rose bob, flower, blue overskirt) and Hazel (brown skin, twin braids, mustard tunic, teal sleeves). All are code-authored original box geometry; no Minecraft models, textures or characters are copied. Shared walk/wave pivots replace directional sprite sheets. The geometric trees, rocks, grass and flowers in `view.ts` are also original. The UI labels this a 3D art study / placeholder models. This is a scalable visual reference, not final art approval or a claim to match Minecraft Dungeons' production quality. The older generated sprite pipeline above is retained as historical provenance only.

`public/art/meadow-title-3d-v1.png` is a 1600×1000 native browser capture of this original 3D Meadow, used as the entry backdrop. It replaces the generated 2D menu backdrop at runtime; no external game artwork is shipped.
