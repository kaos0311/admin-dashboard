# Dependency Remediation Report

Date: 2026-08-12

Scope: controlled remediation of production critical and high dependency audit findings in the root Next.js application and Firebase Functions package. No deployment, production Firebase access, production Cloudflare access, credential rotation, forced audit fix, or Git history operation was performed.

## Before

Root production audit (`npm audit --omit=dev`):

| Critical | High | Moderate | Low |
| -------: | ---: | -------: | --: |
| 3 | 10 | 14 | 0 |

Functions production audit (`npm --prefix functions audit --omit=dev`):

| Critical | High | Moderate | Low |
| -------: | ---: | -------: | --: |
| 1 | 1 | 9 | 1 |

## After

Root production audit (`npm audit --omit=dev --json`):

| Critical | High | Moderate | Low |
| -------: | ---: | -------: | --: |
| 0 | 0 | 9 | 0 |

Functions production audit (`npm --prefix functions audit --omit=dev --json`):

| Critical | High | Moderate | Low |
| -------: | ---: | -------: | --: |
| 0 | 0 | 9 | 1 |

## Dependency Changes

| Package | Previous | New | Direct/Transitive | Reason | Risk |
| ------- | -------: | --: | ----------------- | ------ | ---- |
| `next` | `16.2.3` | `16.3.0` | Direct root dependency | Minimum compatible Next.js update observed to move `postcss`, `nanoid`, and optional `sharp` to patched production versions. | Medium: framework runtime update; validated by typecheck, targeted tests, lint, and build-oriented toolkit gates. |
| `eslint-config-next` | `16.2.3` | `16.3.0` | Direct root dev dependency | Keep ESLint config aligned with the Next.js runtime version. | Low: lint config only; lint completed with zero errors. |
| `next-auth` | `5.0.0-beta.31` | `5.0.0-beta.32` | Direct root dependency | Pulls patched `@auth/core@0.41.3` for original authentication critical/high chain. | Low in this repo: source search found no active `next-auth` API usage; app auth path uses Firebase session code. |
| `@auth/prisma-adapter` | `2.11.2` | `2.11.3` | Direct root dependency | Pulls patched `@auth/core@0.41.3` for original adapter/auth chain. | Low in this repo: source search found no adapter usage. |
| `@auth/core` | `0.41.2` | `0.41.3` | Transitive root dependency | Patched critical/high auth core finding through `next-auth` and `@auth/prisma-adapter`. | Low: transitive update only. |
| `@prisma/adapter-pg` | `7.8.0` | `7.9.1` | Direct root dependency | Keep Prisma adapter aligned with Prisma patch line. | Low: patch update; no source API change required. |
| `@prisma/client` | `7.8.0` | `7.9.1` | Direct root dependency | Keep Prisma client aligned with Prisma patch line. | Low: patch update; typecheck passed. |
| `prisma` | `7.8.0` | `7.9.1` | Direct root dependency | Pulls patched transitive `fast-uri` chain through updated Prisma tooling. | Low: patch update; no schema/source change required. |
| `@ericblade/quagga2` | `1.12.1` | Removed | Direct root dependency | Unused direct dependency introduced vulnerable optional `ndarray-pixels`/`sharp` chain. Repository search found no imports or usage. | Low: removed unused package; barcode tests passed against active scanner/barcode code. |
| `pdfjs-dist` | `5.6.205` | Removed | Direct root dependency | Unused direct dependency had high audit finding and major-only upstream fix. Repository search found no imports or usage. | Low: removed unused package; no PDF source path referenced it. |
| `postcss` | `8.4.31` / `8.5.16` | `8.5.23` | Transitive/root lockfile resolution | Patched Next.js build/runtime transitive finding. | Low: transitive update through supported Next.js patch. |
| `nanoid` | `3.3.12` | `3.3.18` | Transitive/root lockfile resolution | Patched transitive finding through updated `postcss`. | Low: transitive update. |
| `sharp` | `0.34.5` | `0.35.3` | Optional transitive root dependency | Patched optional image dependency through `next@16.3.0`; vulnerable optional `@ericblade/quagga2` path was removed. | Medium: optional native package version changed; no direct source usage found. |
| `ndarray-pixels` | `5.0.1` | Removed | Optional transitive root dependency | Removed by deleting unused `@ericblade/quagga2`. | Low: optional dependency removed with unused parent. |
| `form-data` | `2.5.5` | `2.5.6` | Transitive root and Functions override | Patched high finding in Firebase Admin/Google Cloud transitive chain without major parent upgrade. | Medium-low: override stays within compatible `form-data` v2 line. |
| `websocket-driver` | `0.7.4` | `0.7.5` | Transitive root and Functions override | Patched critical finding in Firebase Admin realtime database transitive chain without major parent upgrade. | Medium-low: override stays within `faye-websocket` range `>=0.5.1`. |
| `hasown` | `2.0.3` | `2.0.4` | Transitive root and Functions dependency | Pulled by `form-data@2.5.6`. | Low: transitive patch. |

## Vulnerability Disposition

| Original Finding | Location | Disposition | Justification |
| ---------------- | -------- | ----------- | ------------- |
| `@auth/core` critical/high chain | Root | FIXED | Updated `next-auth` and `@auth/prisma-adapter` to versions resolving `@auth/core@0.41.3`. |
| `next-auth` critical/high chain | Root | FIXED | Updated `next-auth` from `5.0.0-beta.31` to `5.0.0-beta.32`; no active source API usage found. |
| `@auth/prisma-adapter` high chain | Root | FIXED | Updated from `2.11.2` to `2.11.3`; no active source API usage found. |
| `next` high chain | Root | FIXED | Updated from `16.2.3` to `16.3.0`, the smallest compatible observed Next.js patch line carrying fixed transitive versions. |
| `postcss` high chain | Root | FIXED | Resolved to `8.5.23` through `next@16.3.0`. |
| `nanoid` high chain | Root | FIXED | Resolved to `3.3.18` through updated `postcss`. |
| `sharp` high chain | Root | FIXED | Resolved optional Next.js path to `0.35.3`; removed unused Quagga path that also introduced vulnerable image processing dependencies. |
| `@ericblade/quagga2` high chain | Root | FIXED | Removed unused direct dependency after repository-wide search found no imports or API usage. |
| `ndarray-pixels` high chain | Root | FIXED | Removed with unused `@ericblade/quagga2`. |
| `pdfjs-dist` high chain | Root | FIXED | Removed unused direct dependency after repository-wide search found no imports or API usage. Major `pdfjs-dist@6` upgrade was avoided because the package was unused. |
| `fast-uri` high chain | Root | FIXED | Updated Prisma packages from `7.8.0` to `7.9.1`, resolving the vulnerable Prisma tooling transitive chain. |
| `form-data` high chain | Root | FIXED | Added root override to `form-data@2.5.6`, satisfying the patched v2 line used by Firebase Admin/Google Cloud dependencies. |
| `websocket-driver` critical chain | Root | FIXED | Added root override to `websocket-driver@0.7.5`, satisfying the compatible range used by `faye-websocket`. |
| `form-data` high chain | Functions | FIXED | Added Functions override to `form-data@2.5.6`, satisfying the patched v2 line used by Firebase Admin/Google Cloud dependencies. |
| `websocket-driver` critical chain | Functions | FIXED | Added Functions override to `websocket-driver@0.7.5`, satisfying the compatible range used by `faye-websocket`. |

No original critical/high vulnerability was deferred. Remaining audit output is moderate/low only.

## Deferred Major Upgrades

| Package | Current | Required/Reported Fix | Severity Remaining | Reason Deferred | Recommended Follow-up |
| ------- | ------: | --------------------: | ------------------ | --------------- | --------------------- |
| `firebase-admin` | `13.10.0` | `14.2.0` | Moderate | `npm audit` recommends a major upgrade for remaining Google Cloud/Firebase Admin moderate findings. The objective was critical/high remediation; a major Firebase Admin migration should be handled as a separate compatibility task. | Plan and test Firebase Admin 14 migration across server auth, callable functions, emulator tests, and deployment configuration. |

## Source Changes

No application source files were modified for dependency compatibility.

Compatibility inspection performed:

- Authentication search covered `next-auth`, `@auth/core`, `@auth/prisma-adapter`, `getServerSession`, `authOptions`, `SessionProvider`, `useSession`, `signIn`, `signOut`, `callbacks`, `providers`, and `adapter`.
- Image/document search covered `pdfjs-dist`, `pdf-parse`, `@ericblade/quagga2`, `Quagga`, `quagga`, `ndarray-pixels`, `sharp`, `nanoid`, `fast-uri`, and `postcss`.
- Active PDF usage remains in Functions through `pdf-parse`, which was not changed.
- Active barcode/scanner tests use the existing barcode implementation, not `@ericblade/quagga2`.

## Tests Added or Modified

No tests were added or modified. Existing targeted coverage was run for authentication session helpers and barcode/inventory lookup behavior.

## Validation Results

| Validation | Result | Notes |
| ---------- | ------ | ----- |
| Typecheck | PASS | `npm run typecheck` completed successfully. |
| Functions build | PASS | `npm --prefix functions run build` completed successfully. Local Node was `v24.18.1`; Functions package declares Node `22`, so npm emitted EBADENGINE warnings during install, not during build failure. |
| Lint errors | PASS | `npm run lint` exited 0 with zero errors. |
| Lint warnings | 184 warnings | Existing warning classes include import sorting, unused variables, `no-console`, and EOF newline warnings. |
| Targeted tests | PASS | `npx vitest run src/lib/auth/session.test.ts src/lib/auth/session-csrf.test.ts src/lib/auth/require-api-auth.test.ts src/lib/auth/require-user.test.ts src/lib/__tests__/barcode.test.ts src/lib/__tests__/barcode-safety.test.ts src/lib/__tests__/inventory-lookup.test.ts src/lib/__tests__/receive-inventory-client.test.ts` passed 117 tests across 8 files. |
| Golden emulator | PASS | `.\scripts\toolkit\toolkit.ps1 golden -IncludeEmulator` exited 0. Firestore emulator emitted expected permission-denied logs from negative rules assertions. |
| Full validation | PASS | `.\scripts\toolkit\toolkit.ps1 validate -IncludeEmulator` exited 0 after lint, typecheck, root tests, golden regression, domain/inventory write validators, Functions tests/build, Next build, and emulator tests. |
| Root production audit | PASS for critical/high; audit command exits nonzero for moderate | After remediation: 0 critical, 0 high, 9 moderate, 0 low. |
| Functions production audit | PASS for critical/high; audit command exits nonzero for moderate/low | After remediation: 0 critical, 0 high, 9 moderate, 1 low. |
| Release readiness command | FAIL | `.\scripts\toolkit\toolkit.ps1 release -AllowBranch ai-development -IncludeHistorySecretScan` exited 1. Passing checks included allowed branch, repository hygiene, secret preflight, and AHM validation. Failing/blocking checks included dirty working tree, no upstream tracking branch, root production audit nonzero for moderate findings, and Functions production audit nonzero for moderate/low findings. |

## Lockfile Review

Expected lockfile changes:

- Root lockfile updated Next.js, Next SWC optional packages, Next optional `sharp`, `postcss`, `nanoid`, Auth.js packages, Prisma packages, and override-resolved `form-data`/`websocket-driver`.
- Functions lockfile updated only override-resolved `form-data`, `hasown`, and `websocket-driver`.
- Removed root lockfile entries for unused `@ericblade/quagga2`, `pdfjs-dist`, `ndarray-pixels`, and their dependency tree.

Flagged observations:

- `next@16.3.0` and `sharp@0.35.3` require Node `>=20.9.0`, compatible with the repo's current Node 22 target.
- `pdfjs-dist@6.x` was not adopted because it requires Node `>=22.13.0 || >=24` and the package was unused.
- During install, npm warned it could not remove one locked old Next SWC native file under `node_modules`; this did not affect lockfiles or validation.
- During Functions install, npm warned that local Node `v24.18.1` does not match the Functions package engine `22`; this is an environment warning, not a dependency vulnerability.
- After the clean root install, `npx prisma generate` was required to restore generated Prisma client typings before typecheck.

## Release Readiness

Critical/high production dependency findings have been remediated in both root and Functions audits. The repository is not expected to be release-ready until broader gate blockers are addressed:

- Production audits still exit nonzero due to documented moderate/low findings.
- The release gate may still enforce zero audit findings, not just zero critical/high.
- The worktree contains unrelated pre-existing changes and deleted backup artifacts outside this dependency remediation.
- Git upstream/history checks may still fail independently of dependency remediation.
