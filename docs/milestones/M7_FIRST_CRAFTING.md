# M7 first crafting loop

Authorized by “Let’s do M7” on 2026-09-07. This request advances implementation despite the separately recorded M6 backup/performance gates; it does not turn those gates into passes. Stop before M8.

## Scope and acceptance

Loose stone on the east trail can be gathered by hand. Hand-craft a Stone Axe for 3 wood + 2 stone in the satchel; having it automatically increases tree yield from 3 to 5 wood. Place a Workbench for 6 wood only at either marked camp alcove. No arbitrary placement, dismantling, settlement pieces, queues or recipe tree.

Require authoritative input/cost/capacity checks, duplicate-safe outcomes, competing placement rejection, station collision and durable tool/placement recovery. Verify two separate browser contexts performing the actual gathering/crafting/placement journey. Preserve existing saved identities and baseline terrain.

## Decisions

- Recipe and plot definitions are separate from instances. Eight stable loose-stone nodes are appended to the existing resource order along the clear east trail. Existing depleted IDs and baseline terrain are unchanged.
- Craft/place intents extend the existing sequenced gather stream with optional `action` and a definition/plot `target`; clients never supply inventories, costs, rewards or placement coordinates. Success receipt, inventory and station are one Postgres aggregate transaction, before publication. Failed actions retain all ingredients. Capacity is evaluated after provisional ingredient removal.
- The two one-tile plots are north/south of the starting campfire, outside spawn and the cross-map trails/gate route. Server checks range, occupancy and collision. A placed station is solid, shared, permanent in M7 and has an immutable owner. Workbench recipes and dismantling remain later work.
- Wire protocol 3 separates incompatible M7 item/snapshot schemas from old clients. Saved-world namespaces, metadata and generation IDs remain unchanged so M6 saves load additively. Missing `benches` means empty. Existing JSONB schema needs no SQL table change; new durable validation prevents station removal or ownership regression. All gateways and clients must update together for deployment; do not perform a mixed M6/M7 rolling release against active rooms.
- Original Three.js block models and markers are placeholder art. The satchel stays closed until opened; crafting appears inside it.

## Verification

Local implementation is verified at https://astraworld.localhost:1355/ with two game gateways, Redis and PostgreSQL. No production deployment or cloud provisioning was performed.

- **80/80 Vitest tests passed**, none skipped, using real local PostgreSQL. Coverage includes craft conservation, duplicate commands, output-capacity rejection without loss, insufficient ingredients, competing/occupied/out-of-range/unknown plots, creature occupancy, forged fields, 100-seed clear plots/stone placement, improved axe yield, cold database loading of tools/stations, exactly two journal results and non-regressing placements. Existing network/fault/recovery tests also passed. [Test report](evidence/m7-tests.json), [network recovery](evidence/m7-integration.json).
- TypeScript and optimized Next.js build passed. An initial client-directive placement error was fixed before browser verification; the final build passed.
- Two independent browser contexts completed actual stone/tree gathering, hand crafting, increased wood yield, shared Workbench placement, solid collision and reload continuity. An early click during gathering cooldown revealed a UI issue; crafting buttons now wait for the acknowledged cooldown and pending command. [Browser report](evidence/m7-browser.json), [satchel](evidence/m7-crafting.png), [placed station](evidence/m7-workbench.png).
- Eight independent members passed movement, facing, waves, appearance, ninth admission rejection and same-member resume. [Eight-player report](evidence/m7-eight.json). This is correctness evidence, not a new eight-window performance acceptance.

- Existing two-player gathering → combat → taming → interrupted gate utility → shared Forest entry regression passed. [Adventure report](evidence/m7-slice-browser.json). All three final browser scenarios passed in 2.3 minutes.

## Remaining limits and next eligible work

The crafting/station loop is complete within this local test envelope. Hosted protocol-3 lifecycle/rollout and a hosted M7 playthrough remain unverified. M6’s provider PITR/retention and inherited human/performance gates remain open. No new ten-minute soak or Safari/Firefox matrix was run.

Workbench placement is permanently limited to two camp plots. The one hand-crafted recipe does not require using the workbench; no dismantling, chests or general building UI are included. Station art is an original placeholder. No SQL tables changed: additive aggregate validation was tested against old-style states and new stations.

M8 settlement building is the next content milestone, but is not authorized or started. Before publishing M7, coordinate the protocol update and verify hosted recovery; do not assume local success proves deployment overlap.

### Local connection repair

A later user report of lost controls was traced to local Redis port 6380 refusing connections while the two gateways and browser were still running. The database saved world remained readable. Restarting loopback Redis restored the existing character without resetting its world. Local startup now daemonizes the shared, non-persistent Redis process so it outlives a temporary launcher terminal, like the existing local Postgres service. Explicit shutdown is documented in README.

Verified Redis PONG, the user’s browser leaving Reconnecting with health/inventory controls restored, and actual keyboard input changing the authoritative position. JavaScript syntax and diff checks passed. No gameplay rules changed.
