# Engineering Toolkit

A collection of PowerShell scripts for linting, type-checking, building,
auditing, and verifying the health of the **admin-dashboard** repository.

All scripts live under `scripts/toolkit/` and share a common helper module
(`toolkit-common.ps1`) that provides color-coded output, project path
resolution, and reliable exit-code capture.

---

## Quick Start

```powershell
# Show available commands
.\scripts\toolkit\toolkit.ps1 help

# Run a single check
.\scripts\toolkit\toolkit.ps1 lint

# Run all core checks (lint + typecheck + build + build-functions)
.\scripts\toolkit\toolkit.ps1 all

# Run the full release-readiness gate
.\scripts\toolkit\toolkit.ps1 release

# Include a redacted Git-history secret scan in the release gate
.\scripts\toolkit\toolkit.ps1 release -IncludeHistorySecretScan
```

You can also run any script directly:

```powershell
.\scripts\toolkit\lint.ps1
.\scripts\toolkit\health-check.ps1
.\scripts\toolkit\git-status.ps1 -Short
```

---

## Scripts

### `toolkit-common.ps1` (shared module)

**Purpose:** Provides shared functions used by all other scripts. Not meant to
be run directly — it is dot-sourced by each script.

**Key functions:**

| Function | Description |
|---|---|
| `Write-SectionHeader` | Prints a titled separator banner |
| `Write-SubHeader` | Prints a sub-section header |
| `Write-Step` | Prints a step description |
| `Write-Success` / `Write-Failure` | Prints a pass/fail message with color |
| `Write-WarningItem` / `Write-Info` | Prints a warning/info message |
| `Get-ProjectRoot` | Returns the project root directory |
| `Get-FunctionsDir` | Returns the `functions/` directory path |
| `Test-CommandExists` | Checks if a CLI command is on PATH |
| `Invoke-NpmScript` | Runs an npm script and returns the exit code |
| `Invoke-ToolCommand` | Runs an arbitrary CLI command and returns exit code |
| `Exit-WithSummary` | Prints a summary table and exits with the correct code |

---

### `lint.ps1`

**Purpose:** Runs ESLint static analysis on the main application and
(optionally) the Cloud Functions package.

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `-IncludeFunctions` | switch | off | Also lint `functions/` |
| `-Fix` | switch | off | Pass `--fix` to ESLint |

**Examples:**

```powershell
.\scripts\toolkit\lint.ps1                          # Lint main app
.\scripts\toolkit\lint.ps1 -IncludeFunctions       # Lint app + functions
.\scripts\toolkit\lint.ps1 -Fix                    # Lint and auto-fix
```

**Exit code:** `0` = all linting passed, `1` = lint errors found.

---

### `typecheck.ps1`

**Purpose:** Runs TypeScript type-checking (`tsc --noEmit`) on the main
application and the Cloud Functions package. The main `tsconfig.json` excludes
`scripts/` and `functions/`, so each package is checked with its own compiler
options.

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `-IncludeFunctions` | bool | `$true` | Also type-check `functions/` |

**Examples:**

```powershell
.\scripts\toolkit\typecheck.ps1                          # Check both
.\scripts\toolkit\typecheck.ps1 -IncludeFunctions:$false # Main app only
```

**Exit code:** `0` = no type errors, `1` = type errors detected.

---

### `build.ps1`

**Purpose:** Builds the Next.js production bundle (`next build`). If
`node_modules` is missing, it runs `npm install` first.

**Parameters:** None.

**Example:**

```powershell
.\scripts\toolkit\build.ps1
```

**Exit code:** `0` = build succeeded, `1` = build failed.

---

### `build-functions.ps1`

**Purpose:** Builds the Firebase Cloud Functions TypeScript package. By
default performs a clean rebuild (`rimraf lib && tsc`). Compiled JavaScript is
emitted to `functions/lib/`.

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `-NoClean` | switch | off | Skip clean step (incremental build) |
| `-Watch` | switch | off | Start `tsc --watch` (does not exit) |

**Examples:**

```powershell
.\scripts\toolkit\build-functions.ps1              # Clean rebuild
.\scripts\toolkit\build-functions.ps1 -NoClean    # Incremental build
.\scripts\toolkit\build-functions.ps1 -Watch      # Watch mode
```

**Exit code:** `0` = build succeeded, `1` = build failed.

---

### `audit-deps.ps1`

**Purpose:** Audits npm dependencies for known security vulnerabilities and
(optionally) lists outdated packages. Runs against both the main application
and the Cloud Functions package.

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `-IncludeFunctions` | bool | `$true` | Also audit `functions/` |
| `-IncludeDev` | switch | off | Include devDependencies in audit |
| `-Outdated` | switch | off | Also run `npm outdated` |
| `-Fix` | switch | off | Run `npm audit fix` instead of just reporting |

**Examples:**

```powershell
.\scripts\toolkit\audit-deps.ps1                           # Production audit
.\scripts\toolkit\audit-deps.ps1 -IncludeDev -Outdated      # Full audit
.\scripts\toolkit\audit-deps.ps1 -Fix                       # Auto-fix vulns
```

**Exit code:** `0` = no vulnerabilities, `1` = vulnerabilities found.

---

### `release-readiness.ps1`

**Purpose:** Runs the fail-closed production release gate. It verifies Git
status, branch/upstream, repository hygiene, redacted secret preflight, the
baseline validation gate with emulator coverage, and root plus Functions
production dependency audits.

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `-AllowBranch` | string | empty | Permit a release branch other than `main`/`master` |
| `-SkipAudit` | switch | off | Skip `npm audit --omit=dev` |
| `-IncludeHistorySecretScan` | switch | off | Also scan Git history for obvious credential patterns |

**Examples:**

```powershell
.\scripts\toolkit\release-readiness.ps1
.\scripts\toolkit\release-readiness.ps1 -AllowBranch release-1.0
.\scripts\toolkit\release-readiness.ps1 -IncludeHistorySecretScan
```

**Exit code:** `0` = release gate passed, `1` = one or more checks failed.

---

### `dead-code.ps1`

**Purpose:** Performs heuristic static analysis to detect potentially unused
source files and exported symbols. Uses regex-based import scanning that
understands the `@/` path alias (→ `src/`) and relative imports.

**What it detects:**
1. Source files in `src/` that are never imported by any other file.
2. Exported symbols (functions, constants, classes, types, interfaces, enums)
   that are never imported elsewhere.

**What it excludes (entry points by convention):**
- Next.js App Router files (`page`, `layout`, `loading`, `error`, `not-found`,
  `global-error`, `template`, `default`, `api/`)
- `middleware.ts`, `instrumentation.ts`
- Test files (`.test.`, `.spec.`)
- Type declaration files (`.d.ts`)
- Barrel files (`index.ts` / `index.tsx`)

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `-IncludeFunctions` | switch | off | Also scan `functions/src/` |
| `-ExportReport` | switch | off | Write a CSV report to `dead-code-report.csv` |

**Examples:**

```powershell
.\scripts\toolkit\dead-code.ps1                           # Scan src/
.\scripts\toolkit\dead-code.ps1 -IncludeFunctions          # Scan both
.\scripts\toolkit\dead-code.ps1 -IncludeFunctions -ExportReport
```

> **⚠️ Important:** This is a heuristic tool. It **will** produce false
> positives for dynamically imported files, convention-loaded entry points,
> re-exported barrel files, and symbols used only in type inference. Review
> each result manually before deleting code.

**Exit code:** Always `0` (informational only — never fails the build).

---

### `health-check.ps1`

**Purpose:** Runs a comprehensive project health check covering the
development environment, dependencies, configuration files, environment
variables, Git repository, source directories, build outputs, and disk space.

**Checks performed:**

| Category | Checks |
|---|---|
| Runtime | Node.js, npm, git, firebase CLI, npx |
| Dependencies | Root `node_modules`, functions `node_modules` |
| Config files | `package.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `postcss.config.mjs`, `vitest.config.ts`, `prisma.config.ts`, `prisma/schema.prisma` |
| Environment | `.env`, `.env.local`, `.env.development`, `.env.production`, `.env.example` |
| Git | Repository initialized, current branch, HEAD commit |
| Source dirs | `src/`, `functions/src/` |
| Build outputs | `.next/`, `functions/lib/` |
| Disk space | Free space on project drive |

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `-Quiet` | switch | off | Suppress informational output |

**Example:**

```powershell
.\scripts\toolkit\health-check.ps1
.\scripts\toolkit\health-check.ps1 -Quiet
```

**Exit code:** `0` = all critical checks passed, `1` = critical checks failed.

---

### `git-status.ps1`

**Purpose:** Reports the current Git repository status including branch,
upstream tracking, ahead/behind counts, staged/modified/untracked files,
stash count, and recent commit log.

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `-Short` | switch | off | Compact one-line summary |
| `-NumCommits` | int | `10` | Number of recent commits to show |

**Examples:**

```powershell
.\scripts\toolkit\git-status.ps1                    # Full report
.\scripts\toolkit\git-status.ps1 -Short            # One-line summary
.\scripts\toolkit\git-status.ps1 -NumCommits 5     # Show 5 commits
```

**Exit code:** `0` = working tree clean and up to date, `1` = uncommitted
changes or out of sync with remote.

---

### `release-readiness.ps1`

**Purpose:** Runs a full release-readiness gate before deployment. This is the
most comprehensive check — it verifies that the project is in a deployable
state.

**Checks performed (in order):**

1. Git working tree is clean (no uncommitted changes)
2. On an allowed branch (`main` or `master`, or `-AllowBranch <name>`)
3. Up to date with remote (no unpushed/unpulled commits)
4. Repository hygiene preflight passes
5. Redacted secret preflight passes
6. Baseline validation gate passes with emulator coverage
7. No production dependency vulnerabilities in the root package or Functions package (`npm audit --omit=dev`)

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `-AllowBranch` | string | `""` | Allow a specific branch name |
| `-SkipAudit` | switch | off | Skip dependency audit |
| `-IncludeHistorySecretScan` | switch | off | Include redacted Git-history secret scan |

**Examples:**

```powershell
.\scripts\toolkit\release-readiness.ps1                          # Full gate
.\scripts\toolkit\release-readiness.ps1 -AllowBranch develop    # Allow branch
.\scripts\toolkit\release-readiness.ps1 -IncludeHistorySecretScan
```

**Exit code:** `0` = project is release-ready, `1` = one or more checks failed.

---

### `toolkit.ps1` (entry point)

**Purpose:** Unified entry point that can run any individual script or a group
of scripts. Forwards extra arguments to the underlying script.

**Commands:**

| Command | Runs |
|---|---|
| `lint` | `lint.ps1` |
| `typecheck` | `typecheck.ps1` |
| `build` | `build.ps1` |
| `build-functions` | `build-functions.ps1` |
| `audit` | `audit-deps.ps1` |
| `dead-code` | `dead-code.ps1` |
| `health` | `health-check.ps1` |
| `git-status` | `git-status.ps1` |
| `release` | `release-readiness.ps1` |
| `all` | lint + typecheck + build + build-functions (in sequence) |
| `help` | Shows usage help |

**Examples:**

```powershell
.\scripts\toolkit\toolkit.ps1 help
.\scripts\toolkit\toolkit.ps1 lint
.\scripts\toolkit\toolkit.ps1 all
.\scripts\toolkit\toolkit.ps1 release -IncludeHistorySecretScan
.\scripts\toolkit\toolkit.ps1 dead-code -IncludeFunctions -ExportReport
.\scripts\toolkit\toolkit.ps1 git-status -Short
```

---

## Exit Codes

All scripts follow a consistent exit code convention:

| Exit Code | Meaning |
|---|---|
| `0` | Success — all checks passed |
| `1` | Failure — one or more checks failed |

The only exception is `dead-code.ps1`, which always exits `0` because it is
informational only.

---

## Prerequisites

- **PowerShell 5.1+** (Windows PowerShell or PowerShell Core 7+)
- **Node.js** (with npm)
- **Git** (for git-status and release-readiness scripts)
- **Firebase CLI** (optional — only needed if you want the health check to
  confirm its presence)

All scripts auto-detect the project root by walking up from `$PSScriptRoot`
to find `package.json`. No environment variables or configuration files are
required.

---

## File Structure

```
scripts/toolkit/
├── README.md                # This documentation
├── toolkit-common.ps1       # Shared helper module (dot-sourced)
├── toolkit.ps1              # Unified entry point
├── lint.ps1                 # ESLint static analysis
├── typecheck.ps1            # TypeScript type-checking
├── build.ps1                # Next.js production build
├── build-functions.ps1      # Firebase Cloud Functions build
├── audit-deps.ps1           # Dependency security audit
├── dead-code.ps1            # Dead code detection (heuristic)
├── health-check.ps1         # Comprehensive project health check
├── git-status.ps1           # Git repository status report
└── release-readiness.ps1    # Full release-readiness gate
```

---

## Integration with CI/CD

These scripts can be used in CI/CD pipelines. Example for GitHub Actions:

```yaml
- name: Release Readiness Gate
  shell: pwsh
  run: .\scripts\toolkit\toolkit.ps1 release -IncludeHistorySecretScan
```

Example for Azure DevOps:

```yaml
- task: PowerShell@2
  inputs:
    filePath: 'scripts/toolkit/release-readiness.ps1'
    arguments: '-IncludeHistorySecretScan'
```

---

## Notes

- These scripts do **not** modify any application code. They only read and
  analyze the codebase and run existing npm scripts.
- The `dead-code.ps1` script uses regex-based heuristics, not a full AST
  analysis. Always review its output manually before deleting code.
- The `release-readiness.ps1` script runs all checks sequentially and will
  continue even if an earlier check fails, so you get a complete picture of
  what needs to be fixed.
- All scripts use `cmd /c` to run external commands, which prevents npm's
  stderr output from triggering PowerShell error handling.
