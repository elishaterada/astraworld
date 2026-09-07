# M1 character selection and invitations

Implemented 2026-09-06 within M1. No M2 mechanics or new services.

Players start a private Meadow, then use Menu → Invite a friend → Copy invite link. A friend opens that URL, chooses a name and appearance, and enters the same world. Capacity remains two identities. Loopback links are only usable on the same computer; use the hosted URL for separate devices. Hosted access still requires the existing Vercel authorization.

Fern, Ember and Iris are placeholder colorways of the existing atlas, with matching circle, diamond and star name markers. Selection is cosmetic, not a class or unique account. Choices may repeat; friends should choose different looks. The server validates and stores the selection with temporary membership. Both clients render that membership choice, including after reconnect. Existing sessions without a selection default to Fern. Reload offers Resume Meadow with the saved name/look instead of silently ignoring a new selection. Leave Meadow clears the tab's resume capability.

See [network contract](../NETWORKING.md#cosmetic-membership-extension) and [rendering decisions](../RENDERING.md#m1-character-selector). Simulation and terrain are unchanged. Legacy Redis fanout remains compatible with old gateways; only opted-in WebSocket clients receive the additional cosmetic actor field.

## Verification

- TypeScript and production build passed.
- 25 rule/integration tests passed using real Redis and gateways. Added invalid cosmetic admission checks for local and hosted handlers; two-gateway projection, legacy strict-client compatibility, retained appearance after reconnect and legacy membership fallback checks.
- The first integration run exposed the existing crash test's fixed 1.5-second startup race. It now waits for actual gateway health with a bounded deadline; the full suite passed afterward.
- Independent Chromium sessions selected Ember and Iris through the real form, copied the invite to the clipboard, joined the same room, observed matching appearances and movement, and resumed the same identity/look after reload. No page exceptions. Test: `BASE_URL=http://127.0.0.1:3002 npx playwright test tests/e2e/characters.spec.ts`.
- The first browser attempt caught a radio hit-target problem; native inputs now cover their full visual cards and retain keyboard focus indication. The rerun passed in 3.4 seconds. Screenshots were visually inspected at 1440×900.
- Evidence: `evidence/m1-character-selector.png`, `m1-character-gameplay.png`, `m1-characters.json`, `m1-character-integration.json`.

The existing true TCP packet-loss gate is still pending; this change does not establish full M1 transport acceptance. M2 has not started. Remote walking animation remains a known placeholder limitation. Fullscreen-denied fallback was exercised in the new browser test; native fullscreen is covered by the existing gameplay regression.


Regression follow-up: all six solo gameplay cases and all three multiplayer cases passed across the initial run and targeted reruns. Portrait canvases required scoping old disposal/entry assertions to `.playfield canvas`. The existing gateway-switch test also assumed a 1.5-second offline pause always closed TCP; it now explicitly closes its test-owned WebSocket after the pause to verify a new connection generation on the alternate gateway. The 150/300 ms degraded-traffic cases passed unchanged. These are application/connection fault checks, not the pending IP packet-loss gate.

## Hosted result

`e2abd06` was pushed to origin/main and Vercel's Git status reported deployment complete. The same character browser test then passed against `https://astraworld-teradas.vercel.app` in 7.0 seconds, using two independent contexts with the existing protected-deployment automation access. Both selected appearances matched, clipboard invitation worked, real server movement measured 2.8 tiles during the input hold, collision remained false, and reload retained the same server identity and Ember choice. No page exceptions. The hosted screenshot was visually inspected. Evidence: `evidence/m1-hosted-character-selector.png`, `m1-hosted-character-gameplay.png`, and `m1-hosted-characters.json`. The temporary automation access file was removed; no credential is present in evidence or Git. Vercel authentication protection remains enabled.
