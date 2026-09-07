# M6 durable cooperative release

Authorized by “deploy it and proceed to M6.” The user then connected an existing Neon database through Vercel. No new provider or paid plan is being provisioned. M5's recorded eight-window frame-time and human feedback gates are carried forward, not relabeled as passes. Stop before M7.

## Implementation plan

Use Postgres transactions for a bounded, versioned world aggregate and durable membership capabilities. Preserve the username/appearance entry. A browser-held private recovery credential maps to one durable character/world; no new email or third-party account flow. Resume must outlive Redis TTL/loss; support an explicit recovery-file export/import so browser storage is not the only copy of the capability. Never log tokens or put them in gameplay snapshots.

The proposed normalized tables are a logical sketch. For this finite eight-member reference, a row-locked JSONB world aggregate keeps inventory, taming, depletion, gate and receipts atomic without a multi-table partial-write risk. Separate membership rows enforce eight stable slots; command/result and outbox rows record transitions. Validate content/state before committing, use versioned SQL migrations, and namespace every row by deployment environment. Preserve pinned generation/content versions.

Postgres owner tokens/epochs fence transactions independently of Redis's cache epoch. Claim durable ownership before loading the aggregate. Significant changes must commit before Redis publication/acknowledgment; periodic snapshots alone are not sufficient. Persist safe state at a bounded five-second interval otherwise. On ambiguous DB failure, stop publication and reacquire/reload committed state. Full revisioned snapshots rebuild Redis idempotently; the transactional outbox records recovery work.

Acceptance: migrations and isolated restore; process kill after commit/before reply; duplicate/reused command and ownership fencing; Redis loss; database outage; inventory/companion/gate recovery; eight authenticated members; actual browser resume and recovery-file behavior. Verify the existing hosted M5 deployment first, then local M6 and isolated Neon migration/restore before production M6 release. Never report unrun checks as passed.

## Recovery policy and limits

Browser capabilities are bearer credentials, stored hashed in Postgres. Recovery files must be treated like passwords. There is no email recovery or cross-world user profile yet. A lost browser credential and lost recovery file cannot be recovered by username alone.

The reference retains validated saved poses and tick state, including acknowledged inventory/ownership/depletion/opened gates. Existing generation and pure simulation rules handle interrupted actions without refund; safe-spawn fallback remains an allowed later recovery policy, not a newly implemented reset. Provider backup/PITR retention and restore evidence are separate from process/Redis-loss durability.

## Evidence

Implementation verified locally and on the Neon-backed Vercel preview. Provider backup-setting confirmation and the carried-forward M5 gates remain open.

### Verified implementation (2026-09-07)

- M4/M5 released as `93412cf`, Vercel deployment `dpl_92Z5Civ3rYxaVS7S2fDYZB3qU8Z5`; [production two-player full slice](evidence/m5-hosted-browser.json) passed in 1.3 minutes.
- Migration 1 applied successfully to disposable local Postgres 17 and the user-connected Neon Postgres 18.6 database. No new service or paid plan was provisioned.
- [71 rule/network tests](evidence/m6-tests.json) passed, including real TCP database interruption (no premature reward), SIGKILL plus Redis FLUSHDB, duplicate replay, independent durable owner fencing, and lost COMMIT reply after a real Postgres commit. Full gathering → taming → opened Forest recovery retains inventory and one owned companion. Eight durable slots are enforced; ninth admission fails.
- The same durable transaction and complete network recovery tests passed against Neon (3.67 s and 27.91 s respectively); the TCP fault test intentionally targets only disposable loopback Postgres.
- [Neon test-world restore](evidence/m6-neon-restore.json) passed: 2 worlds, 9 memberships, 12 command records and 22 outbox records restored into an isolated local database and compared by checksum. This proves an application-schema logical restore, not provider point-in-time recovery.
- [Two-player rendered slice](evidence/m6-browser.json) passed locally in 1.3 minutes with 75 ms each-way application delay on one client. [Recovery-key browser check](evidence/m6-recovery-key.json) passed: confirmed inventory survives reload and fresh browser import, with no page errors. Typecheck and optimized build passed.

### Remaining release gates

The Neon dashboard SSO requires authentication in the verification browser; the project's actual restore-window setting is not yet confirmed. Neon documents Free restore history of up to six hours or 1 GB of changes, whichever is reached first; this is a plan limit, not evidence of this project's setting ([Neon pricing](https://neon.com/pricing), [project settings](https://neon.com/docs/manage/projects)). Provider PITR restoration has not been exercised. This remains an explicit disaster-recovery gate before calling M6 a fully accepted public release.

M5's human 10–15 minute playtest and eight-browser p95 frame-time failure remain open. Eight-player correctness is separate from eight simultaneous rendered-window performance. No new ten-minute soak, Safari/Firefox matrix, multi-region writer, external account recovery, or database-disaster loss guarantee is claimed. Command and outbox history are retained for this bounded prototype; define retention before scaling. M7 is not authorized.

### Launch and operations

On this Mac, `npm run db:local` prepares `.local/postgres`; `node --env-file=.env.development.local scripts/migrate.mjs` applies the migration, then `npm run dev` serves the existing Portless hostname. The ignored local environment is loopback-only. Vercel requires server-only `DATABASE_URL` and `REDIS_URL`; production and preview namespaces are separate, with preview commit isolation. SQL migration is explicit and additive, not run on gameplay requests. `.vercelignore` excludes local databases, environment files and test artifacts.

M6 durable worlds start in a new namespace; M5's temporary worlds are not silently imported. Keep a private recovery key from the in-game menu. Leave returns to entry while preserving the browser's key; forgetting a browser key does not delete the database world. Saved pose/tick state is retained on cold recovery, and generation replacement cancels stale actions through the existing pure rules; there is no automatic refund or broad world reset.

- [Eight authenticated browser contexts](evidence/m6-eight.json) passed in 42.7 seconds: distinct membership, synchronized movement/facing/waves, ninth rejection and same-character resume. The initial check exposed generic admission feedback and an insufficient nine-window UI wait; feedback was corrected and the error wait extended to 15 seconds. This is a correctness check, not a frame-time pass.


### Hosted M6 preview

Source `4846db3` deployed successfully as `dpl_fFJ5vAJsNL6aU4vD8Dp1X6yw4PQX` ([preview](https://astraworld-ebenj4b8p-teradas.vercel.app)). All three actual-browser checks passed in 1.9 minutes: [eight-player identity/actions/admission](evidence/m6-hosted-eight.json), [fresh-browser durable recovery](evidence/m6-hosted-recovery-key.json), and [full two-player adventure](evidence/m6-hosted-browser.json). Production remains the verified M4/M5 deployment. Recovery-menu presentation was polished afterward; its final preview and follow-up check are recorded below.
