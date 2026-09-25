# Development Validation Toolkit

A safe, read-only validation toolkit for the **admin-dashboard** repository. These
PowerShell 7 scripts run existing npm scripts and inspect repository state without
modifying application code, installing packages, changing npm scripts, deploying,
or committing.

## Scripts Overview

| Script | Purpose | Modifies anything? |
|---|---|---|
| `scripts\Invoke-ProjectValidation.ps1` | Runs lint, typecheck, build, and functions build; stops on first failure | No (only runs existing npm scripts) |
| `scripts\Get-ProjectHealth.ps1` | Reports environment, dependencies, config, and Git state | No (strictly read-only) |
| `scripts\Get-ReleaseReadiness.ps1` | Pre-release gate combining Git hygiene + validation pipeline | No (never commits/pushes/deploys) |

All three scripts:

- Require **PowerShell 7.0+** (`#Requires -Version 7.0`)
- Use `Set-StrictMode -Version Latest`
- Use `$ErrorActionPreference = 'Stop'`
- Use `Push-Location` / `Pop-Location` wrapped in `try`/`finally`
- Preserve and report the correct exit code
- Do not suppress command output
- Do not expose secrets (environment file contents are never displayed)

---

## `Invoke-ProjectValidation.ps1`

### Purpose

Runs the core project validation pipeline in order and **stops immediately when a
command fails**, preserving and reporting the correct exit code.

### Pipeline (in order)

1. `npm run lint` — ESLint static analysis
2. `npm run typecheck` — TypeScript type-checking (`tsc --noEmit`)
3. `npm run build` — Next.js production build
4. Firebase Functions build (`npm run build` inside `functions\`) — only when
   `functions\package.json` exists

### Supported switches

| Switch | Effect |
|---|---|
| `-SkipLint` | Skip the `npm run lint` step |
| `-SkipTypecheck` | Skip the `npm run typecheck` step |
| `-SkipBuild` | Skip the `npm run build` (Next.js) step |
| `-SkipFunctions` | Skip the Firebase Functions build step |

### Usage examples

```powershell
# Full validation pipeline
.\scripts\Invoke-ProjectValidation.ps1

# Skip the Next.js build (and functions build, since build is skipped)
.\scripts\Invoke-ProjectValidation.ps1 -SkipBuild

# Lint and typecheck only
.\scripts\Invoke-ProjectValidation.ps1 -SkipBuild -SkipFunctions

# Skip only the Cloud Functions build
.\scripts\Invoke-ProjectValidation.ps1 -SkipFunctions
```

### Exit-code behavior

| Exit code | Meaning |
|---|---|
| `0` | All requested checks passed |
| Non-zero | The exit code of the **first failed check** (pipeline stops immediately) |

Skipped checks are reported as `[SKIP]` and do not affect the exit code. Checks
that did not run because the pipeline stopped early are reported as `not run`.

---

## `Get-ProjectHealth.ps1`

### Purpose

Prints a comprehensive, **read-only** snapshot of project health. This script
never modifies, installs, builds, deploys, or commits anything.

### Reported items

- Current directory and project root
- Git branch and working-tree status (staged / modified / untracked counts)
- Node version
- npm version
- PowerShell version and edition
- Whether `package.json` exists
- Whether `functions\package.json` exists
- Whether `node_modules` exists
- Whether `functions\node_modules` exists
- Available npm scripts from `package.json`
- Available functions npm scripts (from `functions\package.json`)
- Presence of common environment files (`.env`, `.env.local`, `.env.development`,
  `.env.production`, `.env.example`) — **contents are never displayed**
- Presence of Firebase configuration files (`firebase.json`, `.firebaserc`,
  `firestore.rules`, `firestore.indexes.json`, `storage.rules`)
- Presence of Next.js configuration files (`next.config.ts`, `next.config.js`,
  `next.config.mjs`, `postcss.config.mjs`, `tsconfig.json`, `eslint.config.mjs`)
- A final health summary

### Supported switches

None. This script takes no parameters.

### Usage examples

```powershell
.\scripts\Get-ProjectHealth.ps1
```

### Exit-code behavior

| Exit code | Meaning |
|---|---|
| `0` | Report generated successfully (informational only) |

This script never fails based on project state — it only reports it. A missing
`node_modules` or dirty tree is reported as a warning, not a failure.

---

## `Get-ReleaseReadiness.ps1`

### Purpose

A pre-release gate that combines Git hygiene checks with the
`Invoke-ProjectValidation.ps1` pipeline. **Never commits, pushes, deploys, or
modifies Git history.**

### Checks performed (in order)

1. Git repository is present
2. Current branch and latest commit reported
3. Working tree is clean (unless `-AllowDirty`)
4. Untracked files checked and reported
5. Staged-but-uncommitted files checked and reported
6. Modified (unstaged) files checked and reported
7. `Invoke-ProjectValidation.ps1` runs (lint, typecheck, build, functions build)

### Supported switches

| Switch | Effect |
|---|---|
| `-AllowDirty` | Allow an unclean working tree (dirty state is still reported as a warning) |
| `-SkipLint` | Forwarded to `Invoke-ProjectValidation.ps1` |
| `-SkipTypecheck` | Forwarded to `Invoke-ProjectValidation.ps1` |
| `-SkipBuild` | Forwarded to `Invoke-ProjectValidation.ps1` |
| `-SkipFunctions` | Forwarded to `Invoke-ProjectValidation.ps1` |

### Usage examples

```powershell
# Full release gate (requires a clean tree)
.\scripts\Get-ReleaseReadiness.ps1

# Allow a dirty tree (e.g., when validating new uncommitted scripts)
.\scripts\Get-ReleaseReadiness.ps1 -AllowDirty

# Allow dirty tree and skip the build steps
.\scripts\Get-ReleaseReadiness.ps1 -AllowDirty -SkipBuild -SkipFunctions
```

### Exit-code behavior

| Exit code | Meaning |
|---|---|
| `0` | All required checks passed — release ready |
| Non-zero | A check failed (the first failure's exit code is returned) |

When `-AllowDirty` is provided, the dirty-tree, untracked, staged, and modified
checks are downgraded from hard failures to warnings, but the validation pipeline
must still pass.

---

## Safe Usage Before Commits

Before committing changes, run the validation pipeline to catch issues early:

```powershell
# Quick check: lint + typecheck only (fast feedback)
.\scripts\Invoke-ProjectValidation.ps1 -SkipBuild -SkipFunctions

# Full check before committing
.\scripts\Invoke-ProjectValidation.ps1
```

For a complete pre-commit picture including Git state:

```powershell
.\scripts\Get-ProjectHealth.ps1
.\scripts\Invoke-ProjectValidation.ps1
```

## AI Agent Validation Contract

Any implementation report from an AI agent must include:

- `FILES CHANGED`
- `TESTS ADDED/MODIFIED`
- `LINT`
- `TYPECHECK`
- `ROOT TESTS`
- `GOLDEN REGRESSION`
- `FUNCTIONS TESTS`
- `FUNCTIONS BUILD`
- `NEXT BUILD`
- `STATIC VALIDATORS`
- `EMULATOR TESTS` when applicable
- `KNOWN FAILURES`
- `BLOCKED CHECKS`
- `OVERALL STATUS`

Required checks that are `FAIL`, `BLOCKED`, `SKIPPED`, or `NOT RUN` must not be
reported as `PASS`. Do not summarize validation as "everything works" unless
every required baseline check actually passed. The toolkit baseline command is:

```powershell
.\scripts\toolkit\toolkit.ps1 validate
```

Run the dedicated Golden Regression Suite with:

```powershell
.\scripts\toolkit\toolkit.ps1 golden
.\scripts\toolkit\toolkit.ps1 golden -IncludeEmulator
```

Any change touching a critical domain must run the Golden Regression Suite.
Critical domains include inventory, domain workflows, auth/authorization, user
management, rental workflows, patient-equipment workflows, and Firebase
Functions. Agent final reports must include `Golden Regression: PASS / FAIL /
BLOCKED`.

Emulator-backed Golden tests use the credential-free project
`demo-advanced-home-medical`, Firestore emulator `127.0.0.1:8085`, and Auth
emulator `127.0.0.1:9099`. They fail closed if emulator hosts, demo project ID,
or credential safety checks are not satisfied.

## Safe Usage Before Deployment

Before deploying, run the full release-readiness gate. This verifies a clean
tree, reports the branch and commit, and runs the entire validation pipeline:

```powershell
# Full release gate (requires a clean, committed tree)
.\scripts\Get-ReleaseReadiness.ps1
```

If you are validating newly added, uncommitted files (such as these scripts
themselves), use `-AllowDirty`:

```powershell
.\scripts\Get-ReleaseReadiness.ps1 -AllowDirty
```

> **Important:** These scripts never deploy. They only verify readiness. Actual
> deployment is performed separately via Firebase CLI or your CI/CD pipeline.

---

## Troubleshooting

### "PowerShell 7.0+ is required"

These scripts use `#Requires -Version 7.0`. Install PowerShell 7 from
[GitHub PowerShell releases](https://github.com/PowerShell/PowerShell/releases)
or via `winget install Microsoft.PowerShell`. Verify with:

```powershell
pwsh -NoProfile -Command "$PSVersionTable.PSVersion"
```

### "npm run lint failed"

- Run `npm install` to ensure dependencies are installed.
- Run `npm run lint` directly to see the full ESLint output.
- Use `.\scripts\Get-ProjectHealth.ps1` to confirm `node_modules` exists.

### "npm run typecheck failed"

- The main `tsconfig.json` excludes `scripts\` and `functions\`, so each package
  is checked independently.
- Run `npm run typecheck` directly to see TypeScript errors.
- For Cloud Functions, run `cd functions && npx tsc --noEmit`.

### "npm run build failed"

- Ensure all environment variables are set (Next.js build may require them).
- Check `Get-ProjectHealth.ps1` output for missing config files.
- Run `npm run build` directly to see the full build output.

### "Functions build failed" / "functions\package.json not found"

- The functions build only runs when `functions\package.json` exists.
- If it exists but the build fails, run `cd functions && npm run build` directly.
- Ensure `functions\node_modules` is installed (`cd functions && npm install`).

### "Working tree is dirty" (release gate)

- Commit or stash your changes before running the release gate.
- Use `-AllowDirty` only for validating uncommitted work (not for actual releases).

### "Validation pipeline threw an error"

- This indicates an unexpected error (not a normal check failure). Review the
  error message and ensure `Invoke-ProjectValidation.ps1` is present and valid.

### Exit code is non-zero but output looks fine

- Check the summary section: `[FAIL]` lines indicate which check failed and its
  exit code.
- Skipped checks (`[SKIP]`) do not affect the exit code.

---

## Relationship to Existing Toolkit

The repository also contains `scripts\toolkit\` with an older PowerShell 5.1
toolkit (`lint.ps1`, `typecheck.ps1`, `build.ps1`, `build-functions.ps1`,
`health-check.ps1`, `git-status.ps1`, `release-readiness.ps1`, etc.). The scripts
in this document are **separate, self-contained PowerShell 7 scripts** that live
directly in `scripts\` and use stricter settings (`Set-StrictMode -Version Latest`
and `$ErrorActionPreference = 'Stop'`). They do not depend on
`toolkit-common.ps1` and do not modify the existing toolkit.

| New script | Overlapping existing script | Key differences |
|---|---|---|
| `Invoke-ProjectValidation.ps1` | `toolkit\toolkit.ps1 all`, `toolkit\release-readiness.ps1` | Stops on first failure; PS7; strict mode; self-contained |
| `Get-ProjectHealth.ps1` | `toolkit\health-check.ps1` | Read-only; reports npm scripts; PS7; strict mode |
| `Get-ReleaseReadiness.ps1` | `toolkit\release-readiness.ps1` | Calls `Invoke-ProjectValidation.ps1`; `-AllowDirty`; never commits; PS7 |

---

## Security Notes

- Environment file **contents are never displayed** — only presence is reported.
- No secrets are printed or logged.
- No packages are installed.
- No npm scripts are changed.
- No deployment is performed.
- No Git history is modified (no commit, push, amend, or rebase).
