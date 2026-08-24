# AHM Dashboard Release Runbook

This runbook documents repository-supported release checks only. It does not contain credentials and does not replace host-specific access procedures.

## Before Release

- Confirm the intended branch and review `git status --short`.
- Do not release with unreviewed application changes, generated artifacts, backup files, or local credentials.
- Confirm the branch has an upstream tracking branch. For `ai-development`, the safe publish/tracking command is:

```powershell
git push --set-upstream origin ai-development
```

- Do not force-push, rewrite history, delete branches, deploy, or rotate secrets as part of release readiness.

## Canonical Validation

Run the release gate from the repository root:

```powershell
.\scripts\toolkit\toolkit.ps1 release -AllowBranch ai-development -IncludeHistorySecretScan
```

`-AllowBranch ai-development` is required while releasing from `ai-development` because the gate defaults to `main` or `master`.

## Git Checks

- Working tree must be clean.
- Branch must be `main`, `master`, or explicitly allowed.
- Upstream tracking must exist.
- Local branch must have no unpushed or unpulled commits relative to upstream.

## Repository Hygiene

Run:

```powershell
node scripts\check-repo-hygiene.cjs
```

The check must not report tracked backup files, generated logs, malformed root filenames, scratch output, `.codex-backups`, or credential-like local artifacts.

## Secret Checks

Run:

```powershell
node scripts\check-secret-preflight.cjs
node scripts\check-secret-preflight.cjs --history
```

Confirmed private credentials are release blockers. Firebase web API-key warnings are not automatically private credentials, but should be reviewed before release.

## Dependency Audit

Run:

```powershell
npm audit --omit=dev
npm --prefix functions audit --omit=dev
```

Critical and high runtime findings are release blockers unless explicitly accepted in a documented risk decision. Do not suppress audit findings to pass the gate.

## Build And Validation

Run these when diagnosing the release gate directly:

```powershell
npm run typecheck
npm run lint
npm --prefix functions run build
.\scripts\toolkit\toolkit.ps1 golden -IncludeEmulator
.\scripts\toolkit\toolkit.ps1 validate -IncludeEmulator
```

Warnings must be reported separately from zero-error exits.

## Firebase Functions

- Do not execute maintenance or destructive Functions during release readiness.
- Do not access production Firebase from this task.
- Functions build validation is local only:

```powershell
npm --prefix functions run build
```

## Windows Services

Known production service names from repository/audit context:

| Service | Purpose | Restart Policy |
|---|---|---|
| AHM-Dashboard | Hosts the dashboard application process | UNKNOWN / VERIFY ON HOST |
| Cloudflared | Runs the Cloudflare tunnel | UNKNOWN / VERIFY ON HOST |

Do not invent or assume NSSM configuration. Verify service definitions on the production host before any release operation.

## Cloudflare

- The Cloudflare tunnel is expected to be external to the repository.
- Do not store Cloudflare credentials in Git.
- Verify app health independently before tunnel health.
- Health verification order: local app health, service status, tunnel status, external route.

## Health Checks

- Local app health route: `src/app/api/health/route.ts`.
- Confirm the app process is running before checking external tunnel reachability.
- Review application logs for startup errors before smoke testing workflows.

## Destructive And Maintenance Functions

Do not execute these during release readiness.

| Function | Purpose | Authorization | Production Risk | Preconditions | Operator Confirmation | Rollback Limitations |
|---|---|---|---|---|---|---|
| `cleanDatabase` | Maintenance cleanup/reset workflow | Callable guard in function source | Can delete or mutate operational data | Verified target, backup/export, dry-run evidence if supported | Explicit written approval | Data restoration may require external backup |
| `resetOperationalDatabase` | Operational database reset | Callable guard in function source | Can reset operational collections | Maintenance window and verified backup/export | Explicit written approval | Rollback depends on backup completeness |
| `rebuildEverything` | Rebuilds operational/reporting derived state | Callable guard in function source | Broad write amplification and stale derived data risk | Stable imports/source data and monitoring plan | Explicit written approval | Partial rebuild may require rerun or restore |
| `rebuildReportsAnalytics` | Rebuilds reporting analytics | Callable guard in function source | Derived analytics churn and cost/runtime risk | Source report data verified | Explicit written approval | Rollback may require previous derived snapshot |
| `reprocessImportJob` | Reprocesses an import job | Callable guard in function source | Can duplicate or overwrite derived import state if misused | Confirm job id and import state | Explicit written approval | Rollback is job-specific and may be limited |
| `softResetReports` | Soft reset of report-derived data | Callable guard in function source | Can clear or rewrite report projections | Maintenance plan and backup/export | Explicit written approval | Restoration depends on original imports and backups |

## Rollback

- Rollback planning must identify the exact Git commit, package lock state, and Functions build artifact.
- For data-impacting changes, rollback requires a verified database backup/export before release.
- Do not rely on Git rollback for Firestore data changes.

## Post-Release Smoke Checks

- Confirm `/api/health` is healthy.
- Confirm authentication/session flow.
- Confirm key dashboard pages load.
- Confirm import/upload page loads without executing destructive maintenance.
- Confirm inventory/rental workflows only after an operator-approved smoke plan.
