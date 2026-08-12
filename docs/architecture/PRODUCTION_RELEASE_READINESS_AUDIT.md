# Production Release Readiness Audit

Date: 2026-08-12
Repository: `D:\projects\admin-dashboard`
Branch: `ai-development`
Verdict: **BLOCKED**

This audit did not deploy, access production Firebase data, modify production
resources, rotate credentials, install dependencies, rewrite history, or change
business workflow logic.

## 1. Executive Summary

The source validation posture is materially stronger than earlier snapshots:
lint, typecheck, root tests, Functions tests, Next build, Functions build,
golden regression, emulator golden regression, static write validators, and
emulator integration tests pass locally.

The repository is still blocked for production release because the Git state is
dirty, the current branch has no upstream tracking branch, the repository
contains many tracked backup/generated artifacts and malformed root filenames,
and production dependency audit reports high/critical vulnerabilities. These
are release process defects even when the application builds.

## 2. Git Repository Health

- Current branch: `ai-development`.
- Upstream: none configured for `ai-development`; release sync cannot be proven.
- Remote: `origin` points to `https://github.com/kaos0311/admin-dashboard.git`.
- Working tree: dirty before and after this audit.
- `core.autocrlf`: `true`.
- `.gitattributes`: absent.
- Recent HEAD: `2ef9b38 feat: harden workflows and add hierarchical inventory management`.

Release status: **BLOCKED** until a release branch with upstream tracking has a
clean status and reviewed commit set.

## 3. Repository Hygiene

New check: `node scripts/check-repo-hygiene.cjs`.

Current result: **FAIL**. The check found 102 release-blocking hygiene findings,
including tracked `.bak-*` files, tracked generated scan/theme artifacts,
tracked malformed zero-byte root files (`0`, `{`, `console.error('IMPORT`), and
tracked backup files already deleted in the working tree.

Untracked scratch created during this audit was removed, except the ignored
`.audit-tmp/validate-include-emulator.log` evidence log.

## 4. Secret Exposure

New check: `node scripts/check-secret-preflight.cjs`.

Current-file result: **WARN only**. Findings are Firebase web API key-like
values in:

- `src/lib/firebase.ts`
- `src/lib/firebase/client.ts`

No private-key block, service-account JSON, OpenAI key, GitHub token,
Cloudflare token, database URL, OAuth token, Slack token, or bearer token pattern
was found by the local preflight.

Git-history result with `--history`: **WARN only** for repeated Firebase web API
key-like values across historical commits. No confirmed private credential was
found by this local scan. This is not a replacement for GitHub Secret Scanning.

## 5. Git History Risks

History contains many committed backup/generated artifacts. The local scan did
not confirm a private credential in history, but GitHub Secret Scanning should
still be run before pushing. If GitHub flags an actual credential, rotate it and
then decide whether history rewrite is required; do not bypass push protection
as the default.

## 6. Environment Configuration

Observed environment categories:

- Public Firebase client config: `NEXT_PUBLIC_FIREBASE_*`.
- Server secrets: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, `OPENAI_API_KEY`,
  `CHATGPT_API_KEY`, `GITHUB_TOKEN`, `RAPIDAPI_KEY`,
  `CHANGE_PHOTOS_API_KEY`, `DATABASE_URL`.
- Runtime/service controls: `ASK_ADMIN_AI_URL`, `RATE_LIMIT_*`,
  `RATE_LIMIT_TRUST_PROXY_HEADERS`, `VERCEL_URL`.
- Local/admin scripts: `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
  `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`.

Gap: no single release manifest documents required production variables,
ownership, rotation process, and whether each is public or secret.

## 7. Firebase Configuration

`firebase.json` deploys Cloud Functions from `functions`, Firestore rules,
Firestore indexes, and Storage rules. Emulators are configured for Firestore
`127.0.0.1:8085` and Auth `127.0.0.1:9099`; Functions and Storage emulators are
not configured there. `.firebaserc` default project is
`advanced-home-medical-55772`.

Functions global region is `us-central1` with `maxInstances: 10`.

Risk: the default Firebase project is production-like while emulator commands
use `demo-advanced-home-medical`. Keep emulator tests credential-free and never
run ad hoc admin scripts without explicit project confirmation.

## 8. Firestore Rules Review

Release review found no temporary global allow. Unknown paths fall through to
`allow read, write: if false`. Protected inventory, rental, patient equipment,
delivery workflow, audit, and transaction rules are present.

Risk remains for broad staff writes in operational collections such as orders,
patients metadata, imports, and some report-derived collections. That is a
domain hardening item, not a same-turn rules change.

## 9. Storage Rules Review

Storage rules gate dashboard access by authenticated staff/admin/tank role and
file type/size in major upload paths. Admin deletes are allowed for many
folders. Rules explicitly avoid active-user Firestore checks for upload
stability.

Release risk: inactive/disabled user revocation depends on app/session handling,
not Storage rules alone.

## 10. API Route Exposure

Routes inspected:

- `/api/health`: public by design; returns status, version, uptime, timestamp,
  and Firebase health booleans/latency only.
- `/api/auth/session`: CSRF, rate limit, verified Firebase ID token, active user
  resolution, HttpOnly session cookie.
- `/api/equipment`: authenticated by `inventory:read`.
- `/api/improvements`: admin/tank, rate-limited.
- `/api/chatgpt`: API-key protected and rate-limited, but powerful read bridge.
- `/api/chatgpt/openapi`: public spec endpoint.
- `/api/jarvis/code-fix`: admin/tank, GitHub token server-side.
- `/api/jarvis/product-enrichment`: authenticated by permissions, but performs
  broad product/inventory enrichment writes.

Questionable release surfaces: `src/app/api/__scratch_nexthttest.test.ts` is a
test file under API tree, and `route.ts.bak-product-image` is tracked.

## 11. Cloud Function Export Review

`functions/src/index.ts` exports callable/trigger functions for user
management, AI/Jarvis, imports, patient documents, QR, rolodex, maintenance,
reset/admin tools, inventory barcode transactions, inventory movement, cleanup,
and domain workflows.

High-risk maintenance exports:

- `cleanDatabase`
- `resetOperationalDatabase`
- `rebuildEverything`
- `rebuildReportsAnalytics`
- `reprocessImportJob`
- `softResetReports`
- `deleteUserAccount`

## 12. Destructive Function Review

Destructive functions generally require callable auth, admin role checks,
rate-limiting, and/or confirmation text. Examples:

- `cleanDatabase`: admin, rate-limited, confirmation `STERILIZE`, dry-run
  option, protected collections, audit log.
- `resetOperationalDatabase`: admin, rate-limited, confirmation
  `RESET DATABASE`, deletes operational collections.
- `softResetReports`: admin, rate-limited, confirmation `RESET REPORTS`.
- `rebuildEverything`: admin, rate-limited, can clear derived data by default.

Release requirement: these functions must be explicitly smoke-tested for
authorization denial and documented in the rollback/runbook before deployment.

## 13. Observability

There is a public `/api/health` endpoint and toolkit health scripts. Cloud
Functions use Firebase logging. No APM/Sentry/OpenTelemetry evidence was found.
Logs may include operational identifiers and error messages; PHI/PII log leakage
requires separate review.

## 14. Health Checks

Current health endpoint covers application liveness and Firebase dependency
probe. Toolkit health checks local runtime/config. No confirmed production
health check covers Windows service status, Cloudflare tunnel status, and
callable Functions health in one readiness view.

## 15. Windows Service Architecture

Repository evidence points to Windows hosting assumptions, Cloudflare tooling on
PATH, and health scripts, but no complete, current service runbook for
`AHM-Dashboard`, NSSM, startup ordering, restart policy, log rotation, and
operator commands was confirmed.

## 16. Cloudflare Architecture

Cloudflare tunnel credentials are not tracked by the new secret preflight.
The production tunnel configuration appears external to the repository.
Documented startup ordering and independent tunnel/app health verification are
still required.

## 17. Deployment Workflow

Derived release sequence:

1. Create or checkout release branch.
2. Confirm clean Git state and upstream tracking.
3. Run `.\scripts\toolkit\toolkit.ps1 release -IncludeHistorySecretScan`.
4. Review release manifest and changed Functions/rules/indexes.
5. Deploy selectively with Firebase CLI only after approval.
6. Build/restart the Windows-hosted Next service.
7. Run health and manual smoke checks.

No deployment was performed during this audit.

## 18. Validation Gate

`scripts/toolkit/release-readiness.ps1` was updated to include:

- clean worktree, branch, and upstream checks;
- repository hygiene preflight;
- redacted secret preflight;
- `validate.ps1 -IncludeEmulator`;
- production dependency audit unless skipped.

This is now a stronger canonical local gate than the previous release script.

## 19. Database Migration Assessment

Prisma has one migration:
`prisma/migrations/20260701133541_init_inventory_schema/migration.sql`.

No required database migration was identified for the current release audit.
Recent inventory hierarchy work appears source/read-derived from the inspected
scope, but any release manifest must confirm changed data model assumptions.

Status: **NO REQUIRED MIGRATION IDENTIFIED**.

## 20. Rollback Strategy

- Next.js app: rollback to previous reviewed commit/build and restart service.
- Functions: redeploy previous known-good function source selectively when
  possible; avoid all-functions deploy unless module graph is known healthy.
- Firestore/Storage rules: redeploy previous rules files.
- Indexes: deploy previous `firestore.indexes.json` if index changes regress.
- Data: cannot assume rollback after destructive callables or migrations;
  restore from backups/export or perform targeted repair with a signed plan.

## 21. Release Manifest

Required manifest fields:

- release version and timestamp;
- commit SHA and branch;
- upstream and clean status;
- validation command results;
- Functions changed;
- rules/indexes changed;
- migration required yes/no;
- known risks;
- rollback commit/build;
- post-release approver and smoke-test owner.

## 22. Pre-Release Checklist

- Clean Git status.
- Release branch has upstream tracking.
- No tracked backup/generated/malformed artifacts.
- `node scripts/check-secret-preflight.cjs --history` reviewed.
- `node scripts/check-repo-hygiene.cjs` passes.
- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run test` passes.
- `npm --prefix functions run test` passes.
- `npm --prefix functions run build` passes.
- `npm run build` passes.
- `toolkit golden -IncludeEmulator` passes.
- `toolkit validate -IncludeEmulator` passes.
- Release manifest completed.
- Rollback plan approved.

## 23. Post-Release Checklist

- App reachable through direct service and Cloudflare tunnel.
- Login/session cookie creation works.
- Dashboard loads.
- Inventory list and scanner pages load.
- Read-only patient/report pages load.
- A representative callable workflow succeeds in a non-destructive way.
- Destructive maintenance callables deny unauthorized callers.
- `/api/health` reports healthy.
- No immediate server/Functions auth errors.
- No unexpected PHI/PII logging observed.

## 24. Blocking Findings

### CRITICAL

- Dirty worktree and deleted tracked files prevent a controlled release.
- Repository contains tracked backup/generated/malformed artifacts.
- No upstream tracking branch for current branch, so push/release sync cannot be
  verified.
- Production dependency audit reports critical vulnerabilities in root
  dependencies and Functions dependencies.

### HIGH

- Destructive maintenance Functions are exported and must have release-runbook
  controls and authorization smoke checks before deploy.
- ChatGPT bridge can read Firestore collections behind one API key; production
  use requires key governance, audit expectations, and scope review.
- Production Windows service/Cloudflare runbook is incomplete from repository
  evidence.

### MEDIUM

- `.gitattributes` is absent while Windows line-ending conversion is enabled.
- Firebase web API key-like values exist in client config/history; likely public
  Firebase config, but GitHub scanning should make final determination.
- Storage inactive-user denial depends on app/session state rather than rules.

### LOW

- Lint still reports warnings.
- Health/version endpoint uses static version `0.1.0`; no commit/build metadata.

## 25. Recommended Remediation Order

1. Resolve Git hygiene: review/remove tracked backups/generated files and
   malformed root files in a dedicated cleanup commit.
2. Set upstream tracking for the intended release branch.
3. Run GitHub Secret Scanning/push protection dry run or protected push review;
   rotate any confirmed private credential before history remediation.
4. Add `.gitattributes` line-ending policy without mass-normalizing existing
   files.
5. Write production Windows service and Cloudflare tunnel runbook.
6. Add release manifest template and require it for deployment approval.
7. Add non-destructive production smoke checklist for auth, health, inventory,
   and callable authorization denial.

## Validation Evidence

Current-turn verification was rerun on 2026-08-12 from branch
`ai-development`. No production deployment, production Firebase data access, or
production resource modification was performed.

- `npm run lint`: PASS, 0 errors, 184 warnings.
- `npm run typecheck`: PASS.
- `npm run test`: PASS, 25 files, 444 tests.
- `npm --prefix functions run test`: PASS, 6 files, 33 tests.
- `npm --prefix functions run build`: PASS.
- `npm run build`: PASS.
- `npm run validate:domain-writes`: PASS.
- `npm run validate:inventory-writes`: PASS.
- `.\scripts\toolkit\golden.ps1 -IncludeEmulator`: PASS.
- `npm run emulators:test`: PASS.
- `.\scripts\toolkit\toolkit.ps1 validate -IncludeEmulator`: PASS; emulator
  permission-denied output occurred during expected negative rules tests.
- `node scripts/check-secret-preflight.cjs`: WARN only.
- `node scripts/check-secret-preflight.cjs --history`: WARN only.
- `node scripts/check-repo-hygiene.cjs`: FAIL, 102 release-blocking hygiene
  findings.
- `.\scripts\toolkit\toolkit.ps1 release -AllowBranch ai-development -SkipAudit`:
  FAIL as designed; Git clean state, upstream sync, and repository hygiene
  failed, while branch, secret preflight, and validation with emulator coverage
  passed.
- `npm audit --omit=dev`: FAIL, 27 vulnerabilities, including 3 critical and
  10 high.
- `npm --prefix functions audit --omit=dev`: FAIL, 12 vulnerabilities,
  including 1 critical and 1 high.

## Files Changed By This Audit

- `.gitignore`
- `scripts/check-repo-hygiene.cjs`
- `scripts/check-secret-preflight.cjs`
- `scripts/toolkit/release-readiness.ps1`
- `scripts/toolkit/README.md`
- `docs/architecture/PRODUCTION_RELEASE_READINESS_AUDIT.md`

Backups for modified existing files were created under
`.codex-backups/release-readiness-20260812-102224/` and
`.codex-backups/20260812-113000-release-readiness-followup/`.
