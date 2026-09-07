# M1 deployed-host verification

The user authorized committing/pushing and continuing on 2026-09-06. `90ae2da` was pushed to `origin/main`; the Vercel Git integration produced a Ready production deployment in `teradas/astraworld` (deployment `dpl_4H11V4QezYxfMmRvUJMHvUk7Po6U`). The project has an existing encrypted `REDIS_URL` in Production and Preview. No new service was provisioned.

The follow-up adds Next.js route handlers using Vercel's experimental WebSocket upgrade API and the existing gateway/runner. Hosted browsers use same-origin `/api/meadow`; local browsers retain the two loopback gateways. Sessions enforce same-origin, schema, body-size and admission-rate checks. WebSocket admission uses the same generation/credential/intent validation as the local transport, with an 8 KiB payload limit.

Hosted functions have a 60-second maximum duration; room ownership rotates at 45 seconds for the lifecycle experiment. Production uses `production:astraworld-m1`; previews use `preview:astraworld-<commit>`, sharing the existing Redis service without sharing room keys. The Redis URL remains server-only. This namespace separation does not provide a separate Redis failure domain.

Production is protected by Vercel authentication. The initial unauthenticated browser visit reached its login page. Deployment Ready does not establish gameplay or lifecycle correctness. Hosted health, authenticated independent browsers, expiry/overlap and Redis latency checks remain pending until verified and recorded below. M2 remains out of scope.

The adapter deployment (`e581253`) reached Ready. Authenticated health returned HTTP 200 with `ready:true`. Two independent protected browser contexts joined through actual hosted WebSockets, but the initial lifecycle run showed frequent transient reconnects; this is a failed stability check, not M1 acceptance.

Review identified that a valid next intent arriving while a Redis write was pending was treated as invalid traffic. The gateway now keeps one bounded latest-intent slot while I/O is in progress. Rate/schema/generation/sequence checks still apply to every received frame; simulation still steps once per server tick. A delayed-adapter regression exercises 120 ms writes with normal 50 ms input. Hosted health also reports Redis ping latency and runtime region for the placement investigation.

`ae99f41` was rejected by Vercel's build because the new health error branch referenced a variable outside its scope. `25275dd` corrected that error, passed the local production build and deployed successfully. Authenticated health measured 21.18 ms Redis round-trip latency in `iad1`.

The second 150-second hosted run (`m1-hosted-coalesced.json`) kept both players connected during ordinary play, with approximately 20 committed simulation ticks/sec between transitions. It observed five epochs and different owner processes as 60-second function lifetimes ended. Both players resumed the same identities. There were no page exceptions. Recovery was sampled only every ten seconds, so this does not establish a precise recovery-time bound or deployment-overlap acceptance.

The next refinement reads metadata, membership, inputs, checkpoint and Redis time in one atomic Lua invocation. This removes mixed-read races and reduces command overhead while preserving the pure step and fenced-write contract. The local 22-test suite and production build passed with this change.
