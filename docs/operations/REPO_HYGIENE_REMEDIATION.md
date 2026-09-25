# Repository Hygiene Remediation

Date: 2026-08-12

## Summary

`node scripts/check-repo-hygiene.cjs` initially reported 102 release-blocking findings. Each finding was classified before deletion. All 102 were tracked backup, generated-output, or malformed root-filename artifacts. Present artifacts were archived outside the repository under `C:\Users\pboyl\.codex\backups\admin-dashboard\repo-hygiene-20260812-120518`, then removed from Git with `git rm`.

After cleanup, `node scripts/check-repo-hygiene.cjs` passed with no tracked release-blocking artifacts.

## Classification Matrix

| Group | Count | Tracked | Generated | Referenced | Classification | Reason |
|---|---:|---|---|---|---|---|
| Malformed root filenames: `0`, `{`, `console.error('IMPORT` | 3 | yes | no | no canonical source reference | DELETE | Zero-byte accidental shell/output filenames at repository root. |
| Timestamped backups: `*.bak-*` and `*.bak-product-image` | 94 | yes | yes | no runtime source reference | DELETE | Historical backup copies with canonical source files present or already missing from worktree. |
| Generated evidence/output: `create-user-after-deploy.json`, `prisma-usage.txt`, `theme-audit-snapshot.txt`, `theme-scan-after-delivery.txt`, `theme-scan.txt` | 5 | yes | yes | no runtime source reference | DELETE | Large generated audit/diagnostic outputs, not permanent documentation. |

## API Tree Disposition

| Path | Finding Type | Tracked | Generated | Referenced | Classification | Reason |
|---|---|---|---|---|---|---|
| `src/app/api/jarvis/product-enrichment/route.ts.bak-product-image` | generated-or-backup-artifact | yes | yes | no | DELETE | Backup route copy under production-packaged API tree; canonical route remains at `src/app/api/jarvis/product-enrichment/route.ts`. |
| `src/app/api/__scratch_nexthttest.test.ts` | scratch/test artifact | yes | no | test-only | KEEP | Existing test support file; not a hygiene finding and not removed without source evidence that it is obsolete. |
| `src/app/api/chatgpt/route.test.ts` | route test | yes | no | test-only | KEEP | Legitimate route test. |
| `src/app/api/improvements/route.e2e.test.ts` | route test | yes | no | test-only | KEEP | Legitimate route E2E test. |

## Scratch And Tooling Disposition

| Path Pattern | Classification | Reason |
|---|---|---|
| `scripts/_scan_*.cjs`, `scripts/_parse_check.ps1`, `scripts/_tess_*` | INVESTIGATE / KEEP | Existing tracked diagnostic tooling, not flagged by hygiene script; left in place. |
| `scripts/call-rebuild-*.cjs`, `scripts/run-rebuild-everything-local.*` | INVESTIGATE / KEEP | Maintenance tooling with production-risk implications; documented in runbook instead of removed. |
| `src/app/api/__scratch_nexthttest.test.ts` | TEST SUPPORT | Tracked test file; left in place. |

## Ignore Policy Added

- Backup patterns: `*.backup`, `*_backup*`.
- Generated evidence: `create-user-after-deploy.json`, `prisma-usage.txt`, `theme-audit-snapshot.txt`, `theme-scan*.txt`, `golden-*-before.json`.
- Malformed/shell output guards: `Get-Process*`, `console.error('IMPORT`.

## Line Ending Policy

`.gitattributes` was added for future commits only. It uses `* text=auto`, preserves Windows-friendly CRLF for PowerShell/CMD/BAT, LF for shell scripts, and marks common binary assets as binary. No repository-wide line-ending normalization was run.
