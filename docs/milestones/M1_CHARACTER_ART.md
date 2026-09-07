# M1 four distinct character designs

Implemented 2026-09-06 after the user's request for four separate characters including women. M1 cosmetic work only; no M2 mechanics, statistics, new actions or services.

## Delivered

- Fern: chestnut hair and green shoulder cloak; Ember: spiky copper hair, orange jacket and charcoal scarf.
- Iris: female adventurer with pink bob, flower clip and blue travel outfit; Hazel: female adventurer with dark twin braids, brown skin, mustard tunic and teal sleeves.
- Four separate generated RGBA sheets, nine measured frames each. Front/back/right standing and two walking steps, mirrored left, 48-pixel standing height, feet anchors and 8 Hz gait. The selector uses the same untinted art. Names and distinct markers remain visible; choices may repeat in eight-player rooms.
- Existing server-owned membership selects the appearance for both local and remote actors. Facing, walking and wave synchronization are retained. `ROOM_REVISION=p8-c4` isolates older strict three-character clients/gateways during rolling deployment. Refresh and create a new Meadow/invitation; previous temporary rooms are not migrated.
- Four cards in the desktop selector; two columns at narrow widths. All assets remain labeled as an art study.

Asset files: `public/art/{fern,ember,iris,hazel}-v1.png`; frame metadata: `public/art/characters-v1.json`. Generated with the built-in image tool; [exact prompts](../art-reference/character-prompts-v1.json). Rejected RGB checkerboard drafts are not shipped. No bitmap repainting or scripted background removal; only runtime source rectangles. See [art direction](../ART_DIRECTION.md) and [rendering contract](../RENDERING.md).

## Local evidence

Environment: macOS, Node 24.13.0, Chromium 153.0.8010.12, production Next frontend at 127.0.0.1:3002, Redis 6380, separate gateways 3103/3104. Desktop viewports 1440×900 and 1280×800; narrow entry 390×844.

- `npm run typecheck`: passed. `npm test`: 35 tests across 11 files passed. `npm run build`: passed. New asset tests check separate PNG sources, actual RGBA format, frame bounds and overlap, four valid IDs and invalid cosmetic rejection.
- `BASE_URL=http://127.0.0.1:3002 CHARACTER_EVIDENCE_PREFIX=docs/milestones/evidence/m1-four-character-local EIGHT_EVIDENCE_PREFIX=docs/milestones/evidence/m1-four-eight-local npx playwright test tests/e2e/characters.spec.ts tests/e2e/eight-players.spec.ts tests/e2e/gameplay.spec.ts`: all eight tests passed in one minute. Four distinct nonempty portrait images; invitation/copy, matching appearance, real movement, resume; eight independent identities across two gateways, ninth rejected, all four appearances agreed across every observer, rendered facing and waves synchronized, Hazel resumed. Six solo regressions passed: normalized movement, collision, camera/resize/focus, remount/disposal, deterministic seed rendering, visibility pause, entry, native fullscreen and denied-fullscreen fallback. No page exceptions.
- `BASE_URL=http://127.0.0.1:3002 npx playwright test tests/e2e/character-art.spec.ts`: passed in 6.6 seconds. Each of four looks exercised front/back/right/mirrored-left standing and moving textures. The first test attempt sampled the previous direction before the next animation frame; the check now waits for a moving frame in the requested row, then waits for that row's standing frame on key release.
- Real browser entry and gameplay screenshots were inspected: four different silhouettes/colors, alpha edges without background boxes, aligned feet and readable name markers. Narrow entry uses two columns. Evidence under `evidence/m1-four-*` and `evidence/m1-art-*`; historical evidence retained unchanged.

## Limits and next eligible work

Generated art remains provisional. Walking is a short stylized loop; left-facing mirrors asymmetric accessories. No separate waving-body animation is added; the existing wave cue is retained. Four full-resolution sheets add about 6.2 MiB of PNG downloads, cached and loaded concurrently per page; this is not a compressed final asset pipeline. No long-duration eight-player soak or Safari/Firefox art pass was run. The existing true TCP packet-loss validation remains the next M1 gate; M2 has not started.

## Hosted result

Runtime commit `1df7cf6` was pushed to `origin/main`; Vercel reported deployment complete. On `https://astraworld-teradas.vercel.app`, the protected-deployment browser checks passed in 36.2 seconds: selector/invitation/resume (8.5s) and eight-player/full-room/reconnect (27.2s). Nine isolated browser contexts exercised all four designs. Every member moved 2.6 tiles, all observers agreed on appearances and rendered facing, wave cues synchronized, the ninth entrant was rejected, and Hazel resumed with the same identity/appearance. No page exceptions. Hosted screenshots were visually inspected. Evidence: `evidence/m1-four-character-hosted-*` and `evidence/m1-four-eight-hosted.*`.

The health endpoint returned ready with Redis available in `iad1` and owner revision `1df7cf6`. Existing Vercel authentication protection was retained; the private temporary automation access file was removed after testing. No new services or credentials were committed. This focused check does not repeat the earlier hosted lifecycle soak or close the pending TCP-loss gate.
