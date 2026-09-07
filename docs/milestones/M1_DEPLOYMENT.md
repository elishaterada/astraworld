# M1 deployed-host verification

The user authorized committing/pushing and continuing on 2026-09-06. `90ae2da` was pushed to `origin/main`; the Vercel Git integration produced a Ready production deployment in `teradas/astraworld` (deployment `dpl_4H11V4QezYxfMmRvUJMHvUk7Po6U`). The project has an existing encrypted `REDIS_URL` in Production and Preview. No new service was provisioned.

The follow-up adds Next.js route handlers using Vercel's experimental WebSocket upgrade API and the existing gateway/runner. Hosted browsers use same-origin `/api/meadow`; local browsers retain the two loopback gateways. Sessions enforce same-origin, schema, body-size and admission-rate checks. WebSocket admission uses the same generation/credential/intent validation as the local transport, with an 8 KiB payload limit.

Hosted functions have a 60-second maximum duration; room ownership rotates at 45 seconds for the lifecycle experiment. Production uses `production:astraworld-m1`; previews use `preview:astraworld-<commit>`, sharing the existing Redis service without sharing room keys. The Redis URL remains server-only. This namespace separation does not provide a separate Redis failure domain.

Production is protected by Vercel authentication. The initial unauthenticated browser visit reached its login page. Deployment Ready does not establish gameplay or lifecycle correctness. Hosted health, authenticated independent browsers, expiry/overlap and Redis latency checks remain pending until verified and recorded below. M2 remains out of scope.
