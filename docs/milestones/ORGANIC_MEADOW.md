# Organic Meadow landscape pass

Authorized after M7 by the request for a less linear, more natural Meadow. This is environment presentation polish; M8 is not started.

## Decisions

- Replace the visual cardinal-road cross with a connected network of footpaths between camp, pond banks and the Forest approach. Bounded deterministic path searches route through existing walkable tiles via irregular waypoints. The route mask is softened with seeded edge noise and small surface facets.
- Use broad patches of meadow greens and uneven dirt clearings, clustered wildflowers and variable grass density. Shift and vary tree crowns while keeping trunks aligned with their collision footprints.
- Add twelve cosmetic butterflies in one instanced draw, with bounded looping motion around the camera. Reduced motion freezes their animation. Dispose the mesh and its shared geometry/material with the scene.
- The minimap shares the presentation trail and ground palette. Baseline terrain, collision, resource IDs, inventory, saved poses, campfire positions and workbench plots remain unchanged. No world migration or new gameplay protocol is needed. Open areas painted as grass remain walkable.
- The landscape is original procedural placeholder art. Existing solid-object placement still uses the saved baseline grid; this pass does not relocate trees, reshape ponds or add wildlife simulation.

## Verification

- TypeScript and optimized Next.js build passed.
- Five landscape/world tests passed: reproducible trails/colors, no mutation of saved terrain, every trail tile walkable, connected trail graph, meaningful meanders away from the old central axes, plus the existing 100-seed reachability and pinned terrain hash checks. The default trail network contains 290 tiles; construction measured 19 ms in one local Node sample.
- Actual browser traversal passed in 11.2 seconds with no collisions or page errors. The last 500 sampled frames had p95 **16.7 ms** (20 ms threshold). The sampled renderer reported 127 draw calls, 440,610 triangles, nine geometries and four textures. This short single-client sample is not an eight-client or ten-minute performance claim. [Report](evidence/organic-meadow-browser.json), [camp view](evidence/organic-meadow-camp.png), [field view](evidence/organic-meadow-field.png).
- Two separate authenticated browser contexts passed stone collection, axe crafting, improved yield, shared workbench placement/collision and saved resume. [Crafting report](evidence/organic-browser.json), [crafting view](evidence/organic-crafting.png), [workbench view](evidence/organic-workbench.png).

- Full two-player gathering → combat → taming → shared Forest gate regression passed. [Adventure report](evidence/organic-slice-browser.json). All three final browser scenarios passed in 1.8 minutes.

Existing local Redis startup repair is preserved as separate work. This pass is running locally and has not been committed, pushed or deployed. No M8 work, new solid footprints, resource reset or save migration was added.
