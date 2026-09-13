# Cloudflare hosting migration — 2026-09-12

User-authorized hosting migration of the current repository, after M7 and the combat/controller expansions. No M8 gameplay. This document supersedes historical Next.js/Vercel launch instructions when it describes the new deployment.

## Architecture and preservation

The single page has no server rendering requirement, server actions, image optimizer, CMS, contact form, or Next-specific navigation. Vite builds the same React/Three.js client and `scripts/prerender.tsx` renders its real entry UI into HTML. The existing title, description, CSS, artwork, characters, invite/debug/solo query modes, recovery import/export, and game controls are retained. `index.html` adds the new canonical URL. Unknown pages and assets return a real 404. Artwork remains in Git; R2 offers no benefit for these ten small static files.

Workers Static Assets serves the frontend. A small Worker handles canonical redirects, origin checks and both `/api/meadow-v2/{session,play,health}` and legacy `/api/meadow/{session,play,health}`. Cloudflare Containers runs the existing Node gateways; the native Workers HTTP adapter does not support Node's WebSocket upgrade event, and replacing the tested runner/storage system with Durable Objects would be a larger behavioral migration. Each environment is capped at two `basic` containers, which sleep after five idle minutes. Active WebSockets keep them in use. Containers, Workers and their Durable Object bindings have usage charges under the existing account plan; this is not a static-only/free game backend.

The pure simulation, protocol 6, seeded worlds, Redis fencing/pubsub and Neon/Postgres transactions remain intact. Server secrets are Workers secrets injected into containers, never build variables, images or static assets. Production retains `production:astraworld-m1v2-p8-c4-m6`; preview uses `preview:cloudflare-migration-p8-c4-m6`. Legacy protocol rooms retain their separate namespace. Preview cannot join or write production worlds through its gateway. No database schema migration is required.

## Infrastructure inventory and backups

- Cloudflare account: Elisha Account, `9f6ccd5848bae286ea52736528583491`.
- Correct zone discovered/created for `elishaterada.com`: `e1810cf144f5053d79b31aa3aed6644d`. Assigned nameservers: `frank.ns.cloudflare.com`, `sunny.ns.cloudflare.com`.
- Registrar remains Namecheap. Original nameservers: `dns1.registrar-servers.com`, `dns2.registrar-servers.com`.
- Existing root and www website, feathercss, makerkits, konyaku, Google verification, Vercel verification and Mailchimp DKIM records were copied without moving their applications. No Namecheap URL forwarding records were present.
- Namecheap has a catch-all to the user's Gmail. The matching Cloudflare destination was already verified; catch-all was staged. DNSSEC parent DS and authoritative DNSKEY responses were backed up before cutover, alongside registrar information. No published DS existed.
- Private backups live under `~/.config/site-migrations/`, outside Git, with `elishaterada.com-*` and `astraworld-*` filenames. They include raw registrar hosts, forwarding, nameservers and domain info; Cloudflare records/settings; production environment; and a consistent read-only production game-data snapshot (4 worlds, 14 members, 303 commands, 2,236 outbox rows at backup time). Do not attach these files to public issues.
- Vercel rollback deployment: `dpl_7V2ukL2xACG3FzNfXYokqxXn6GW3`, `https://astraworld-jlc560pix-teradas.vercel.app`, project `prj_iz8JNEscdwTor5Id4ZhfbPT93M8p` in team `teradas`. No account-wide service is cancelled. `vercel.json` disables new Git-triggered Vercel deployments from this migrated source.

## Commands

Requires Node 24+, npm and Docker for container deployments. Wrangler OAuth is used locally. Never export the DNS-only token as `CLOUDFLARE_API_TOKEN` for Worker deployment.

```sh
npm ci
npm run dev                 # Existing Portless launcher, now Vite + local gateways
npm run build               # Vite + prerender, output dist/
npm run typecheck           # Separate browser/Node and Worker types
npm test
TEST_DATABASE_URL=postgresql://127.0.0.1:55432/astraworld npm run test:durable
npm run deploy:preview      # Build and deploy isolated preview
npm run deploy             # Build and deploy production
```

`npm start -- --port 3002` serves the built frontend locally. Fixed-port gateways still run with `npm run game:realtime`. The existing `NEXT_PUBLIC_GAME_GATEWAYS` variable name remains supported as an explicitly allowlisted public build value for compatibility with local scripts. No other process environment enters Vite's client bundle.

```sh
npx wrangler types --strict-vars=false
npx wrangler deploy --env preview --dry-run
npx wrangler secret bulk /private/path/to/secrets.json --env preview
npx wrangler secret bulk /private/path/to/secrets.json
# File contains only DATABASE_URL and REDIS_URL; never commit it.
BASE_URL=https://astraworld-preview.elishaterada.workers.dev \
  node scripts/verify-cloudflare.mjs
```

On this Mac, the normal Docker config references a removed Desktop credential helper. The migration uses a separate private Docker config pointing to Homebrew buildx and the existing Colima socket. Its temporary registry credentials must remain private. Do not replace other projects' Docker configuration.

## Verification and cutover status

Preview: `https://astraworld-preview.elishaterada.workers.dev`.

- Optimized prerendered build and both type checks pass.
- Initial rule suite: 94 passed, six skipped without a database. Explicit local Postgres run: seven durable checks passed, covering existing recovery/fault/crafting/population/arsenal rules.
- Hosted eight-player test passed with nine independent browser contexts, both gateway owners observed, ninth member refused, same identity resumed, movement/facing/waves synchronized, no page errors. [Evidence](evidence/cloudflare-preview-eight.json).
- Hosted save/reload and recovery file import in a fresh browser passed. [Evidence](evidence/cloudflare-preview-recovery.json).
- Hosted two-player gathering, combat, taming, interrupted dissolution and shared Forest entry passed with added 150 ms application-layer delay. This is not a new TCP-loss test. [Evidence](evidence/cloudflare-preview-slice-browser.json).
- Hosted two-player axe/workbench crafting and reload passed. [Evidence](evidence/cloudflare-preview-browser.json).
- 27 HTTP checks passed: prerendered content/metadata, byte-identical art and bundles, real 404s, both API generations, foreign-origin denial, invalid body denial and oversized-body rejection. [Evidence](evidence/cloudflare-preview-http.json).
- Connection renewal passed for 265 seconds across both clients: about 59.88 server Hz, generations 1 → 2, worst observed gap 1.20 seconds, no page errors. [Evidence](evidence/cloudflare-preview-lifecycle.json).
- Production public HTTPS, 27 HTTP/asset checks, eight-player contention and fresh-browser recovery passed. [HTTP](evidence/cloudflare-production-http.json), [multiplayer](evidence/cloudflare-production-eight.json), [recovery](evidence/cloudflare-production-recovery.json). Recovery exported from the original live Vercel game imported successfully into Cloudflare with the existing inventory. [Cross-origin recovery](evidence/cloudflare-vercel-recovery.json).
- Public Cloudflare and Google resolvers agree on the new nameservers and mail records. [DNS](evidence/cloudflare-public-dns.json). HTTPS enforcement and alternate-host redirects preserve paths and query strings.
- The old Vercel hostname now permanently redirects to the canonical site. `/recover` is deliberately retained with no-store/noindex headers so existing players can download their origin-local key. The new restore panel links to it. The original immutable deployment remains retained behind Vercel deployment protection.
- Email Routing is active and synchronized; actual incoming/outgoing delivery remains unconfirmed pending the user’s mailbox test.

Inherited M5/M6 human/performance/PITR limitations remain open; this migration does not relabel those gates. No new long soak or cross-browser matrix has been claimed.

## Rollback

1. Restore the old Vercel app when needed with `vercel promote https://astraworld-jlc560pix-teradas.vercel.app --scope teradas --yes`. This replaces the redirect on the old aliases. Keep Vercel's immutable production deployment and the existing Redis/Neon integrations. The database namespace is preserved, so compatible gateways can recover committed state. Do not restore the backup over newer acknowledged progress during an ordinary hosting rollback.
2. If a Cloudflare release fails, use `npx wrangler rollback <verified-version-id>` and check the Container rollout separately: Worker and container deployments have distinct lifecycle behavior. Redeploy the known-good commit/image if needed; exercise recovery before reopening traffic.
3. To return the custom hostname to Vercel, attach `astraworld.elishaterada.com` to the existing Vercel project, verify the certificate, then remove its Worker custom-domain binding and configure the Vercel-provided DNS target in Cloudflare. Keep the authoritative Cloudflare zone and email routing intact where possible.
4. A full DNS rollback requires rechecking Namecheap's backed-up records and forwarding, then restoring the two original registrar nameservers. Account for TTL/registry propagation. If Cloudflare DNSSEC is later enabled, remove the parent DS before returning to unsigned Namecheap DNS. Never leave a mismatched DS.
5. Old browser credentials are origin-local. Existing players can export a recovery key on the old origin and import it on the new one. Retain a recovery path on the old hostname when adding its permanent redirect. Never put bearer credentials in query strings, logs or Git.

## Git deployment setup

Both Workers are connected to `elishaterada/astraworld`, release branch `codex/cloudflare-migration`, through the already-authorized Cloudflare GitHub integration and an existing build token. Each push runs `npm run build && npm run typecheck`, then `npx wrangler deploy --env preview` for the preview Worker or `npx wrangler deploy` for production. Other branches do not auto-deploy. A push of `4566feb` successfully built and deployed both environments, including the container image: production version `fcfc058f-4f48-44da-bd1a-35045687754e`, preview `fd4e9300-a2be-4ff3-a9b2-72858d731c78`. The production build log confirmed successful image rollout and completion. Local deployment commands are also verified. Pushes currently deploy preview and production independently; preview is not an automatic approval gate. To introduce a staged release process later, change the production branch in Cloudflare Builds settings. Preview and production have distinct Worker names and namespaces. Do not point arbitrary PR builds at production credentials/namespaces or reuse `wrangler versions upload` for a container release without validating its rollout behavior.


### Cutover progress

Namecheap accepted the nameserver change. Cloudflare and Google public resolvers report the assigned nameservers; the zone is active. HTTPS became available after certificate issuance. Email Routing is enabled, ready and synchronized; three Cloudflare MX records replaced the five backed-up Namecheap MX records. A single SPF record now retains the original Namecheap include and adds Cloudflare; existing Mailchimp DKIM/other TXT records remain unchanged. Gmail send-as configuration was not modified. Actual incoming and outgoing message delivery awaits the user’s test.

### Git rollout regression caught and corrected

The second concurrent Git release exposed inherited Wrangler routes: preview claimed the production custom domain after its later rollout, and origin checks rejected sessions. No production credentials were issued by the preview gateway. Preview now explicitly sets `routes: []`; a regression test first reproduced the missing override, then passed with it. Verify the Cloudflare custom-domain binding points to `astraworld` after both builds finish, alongside HTTP and browser recovery checks. Temporary runtime diagnostics were removed.
