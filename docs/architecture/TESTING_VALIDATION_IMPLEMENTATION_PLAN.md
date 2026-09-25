# Testing and Validation Implementation Plan

Date: 2026-08-07

This plan is intentionally staged. Each stage should be independently reviewable and should preserve existing application behavior unless a defect is explicitly proven.

## Stage 1: Validation Baseline Repair

Objective: Make the current validation baseline trustworthy before adding large test suites.

Files affected:

- `eslint.config.mjs`
- `functions/src/inventory/receiveScannedInventoryIntake.ts`
- `firebase.json`
- `scripts/toolkit/toolkit.ps1`
- `scripts/Invoke-ProjectValidation.ps1`
- Documentation/runbook files

Dependencies:

- No new npm dependencies.
- Existing Node, npm, Firebase CLI, Java.

Tests introduced:

- None required; this stage repairs current command reliability.

Expected runtime:

- 1-3 minutes excluding builds.

Risks:

- Lint ignore changes must not hide real source directories.
- Functions type fixes must preserve current receive-scan behavior.
- Emulator port handling must not mask a real emulator misconfiguration.

Validation command:

```powershell
npm run lint
npm run typecheck
cd functions; npx tsc --noEmit; npm run build; npm test
```

Rollback considerations:

- Revert lint ignore and type fixes if validation behavior broadens or narrows unexpectedly.

## Stage 2: Factories and Synthetic Fixtures

Objective: Create deterministic test data builders for users, roles, inventory, products, locations, rentals, patient equipment, movements, and operation records.

Files affected:

- `src/test-utils/factories/**`
- `functions/src/test-utils/factories/**`
- `functions/src/test-utils/emulator-setup.ts`

Dependencies:

- Stage 1.

Tests introduced:

- Factory self-tests for deterministic IDs, timestamps, and role defaults.

Expected runtime:

- Under 30 seconds.

Risks:

- Accidentally modeling production PHI. Fixtures must be synthetic.
- Overbuilding factories before test needs are clear.

Validation command:

```powershell
npm test
cd functions; npm test
```

Rollback considerations:

- Remove factory files if they introduce confusion without usage.

## Stage 3: Pure Domain Unit Tests

Objective: Expand cheap deterministic tests for helpers, validation, normalization, role checks, scan parsing, quantity calculations, and idempotency fingerprints.

Files affected:

- `src/lib/**`
- `src/app/(admin)/**/lib/**`
- `functions/src/domainWorkflows/shared.ts`
- `functions/src/inventory/types.ts`
- New `*.test.ts` files near source or in existing test folders

Dependencies:

- Stage 2 useful but not strictly required.

Tests introduced:

- Domain helper tests.
- Operation ID validation tests.
- Request fingerprint tests.
- Quantity/state validation tests.

Expected runtime:

- Under 60 seconds.

Risks:

- Testing implementation details instead of stable business behavior.

Validation command:

```powershell
npm test
cd functions; npm test
```

Rollback considerations:

- Remove overly brittle tests; keep behavior-level assertions.

## Stage 4: Inventory Regression Suite

Objective: Build the core inventory regression matrix around scan lookup, receive, product linkage, movement creation, duplicates, and retry/idempotency behavior.

Files affected:

- `functions/src/inventory/*.test.ts`
- `functions/src/test-utils/**/*.emulator.test.ts`
- `src/services/inventory/*.test.ts`
- `src/repositories/firestore/*.test.ts`

Dependencies:

- Stage 1 emulator baseline.
- Stage 2 factories.

Tests introduced:

- Emulator tests for movement success/failure/concurrency.
- Unit tests for UI/client operation ID lifecycle.
- Repository integration tests where Firestore semantics matter.

Expected runtime:

- 3-8 minutes depending on emulator startup.

Risks:

- Slow tests discouraging local use.
- Flaky concurrency assertions if IDs/state reset are weak.

Validation command:

```powershell
npm test
npm run validate:inventory-writes
npm run emulators:test
```

Rollback considerations:

- Keep tests isolated by suite; disable only demonstrably flaky new tests with a tracked issue, never silently treat them as PASS.

## Stage 5: Authorization Regression Suite

Objective: Prove server-side authorization for unauthenticated, admin, staff, tank, disabled, deleted, missing-profile, invalid-claim, stale-claim, and role-mismatch cases.

Files affected:

- `src/lib/auth/*.test.ts`
- `functions/src/adminUserManagement*.test.ts`
- `functions/src/adminUsers*.test.ts`
- `functions/src/test-utils/auth-factories.ts`
- Firestore rules tests when introduced

Dependencies:

- Stage 2 factories.

Tests introduced:

- Callable authorization tests.
- API auth guard edge cases.
- Role escalation rejection tests.

Expected runtime:

- 1-4 minutes.

Risks:

- Mocked tests can falsely pass if they do not exercise callable wrappers or Firestore profile reads.

Validation command:

```powershell
npm test -- --run src/lib/auth src/lib/permissions
cd functions; npm test
```

Rollback considerations:

- Split brittle callable setup from pure auth logic to keep fast tests reliable.

## Stage 6: Repository Integration Tests

Objective: Test repository behavior against Firestore emulator where query ordering, indexes, missing docs, duplicate docs, and snapshot behavior matter.

Files affected:

- `src/repositories/firestore/*.test.ts`
- `src/repositories/postgres/*.test.ts` only if a safe local DB strategy exists
- `functions/src/test-utils/emulator-setup.ts`

Dependencies:

- Stage 1 emulator reliability.
- Stage 2 factories.

Tests introduced:

- Inventory/product/order repository integration tests.
- Duplicate/missing/deleted document cases.

Expected runtime:

- 2-5 minutes.

Risks:

- Accidentally requiring production Firebase.
- Overusing emulator for pure mapping logic.

Validation command:

```powershell
npm run emulators:test
```

Rollback considerations:

- Keep emulator tests under an integration config so unit tests stay fast.

## Stage 7: Firestore Transaction Tests

Objective: Prove transaction rollback, concurrent updates, duplicate requests, stale data handling, missing docs, invalid state, and idempotent operation behavior.

Files affected:

- `functions/src/inventory/movementService.test.ts`
- `functions/src/inventory/*.emulator.test.ts`
- `functions/src/domainWorkflows/*.emulator.test.ts`

Dependencies:

- Stage 4.

Tests introduced:

- `createInventoryMovementInTransaction` emulator suite.
- Rental/patient equipment workflow transaction suites.

Expected runtime:

- 4-10 minutes.

Risks:

- Concurrency tests can become timing-dependent.
- Injected failure seams must not alter production behavior.

Validation command:

```powershell
npm run emulators:test
cd functions; npm run build
```

Rollback considerations:

- Revert failure-injection helpers if they complicate production code.

## Stage 8: Idempotency and Concurrency Tests

Objective: Prove operation keys prevent duplicate logical operations across inventory and domain workflows.

Files affected:

- `functions/src/inventory/**`
- `functions/src/domainWorkflows/**`
- `src/lib/inventory/receive-inventory*.test.ts`

Dependencies:

- Stage 7.

Tests introduced:

- Same key/same request.
- Same key/different request.
- Concurrent duplicate requests.
- Retryable vs terminal client error handling.

Expected runtime:

- 2-6 minutes.

Risks:

- Tests may reveal existing ambiguous behavior around failed operation retry; document before changing.

Validation command:

```powershell
npm test
npm run emulators:test
```

Rollback considerations:

- Preserve any discovered baseline behavior until product/domain owners approve changes.

## Stage 9: Firebase Functions Tests

Objective: Exercise callable boundaries, request parsing, authorization, rate limits, and controlled error codes.

Files affected:

- `functions/src/**/*Functions*.test.ts`
- `functions/src/admin*.test.ts`
- `functions/src/inventory/*Functions*.test.ts`
- `functions/src/domainWorkflows/domainWorkflowFunctions.test.ts`

Dependencies:

- Stage 5.
- Stage 7.

Tests introduced:

- Callable request validation tests.
- Callable auth tests.
- Error-code contract tests.

Expected runtime:

- 2-6 minutes.

Risks:

- `firebase-functions-test` setup can encourage heavy mocks; keep emulator coverage for Firestore semantics.

Validation command:

```powershell
cd functions; npm test; npm run build
```

Rollback considerations:

- Keep callable tests separate from workflow service tests so failures are easier to diagnose.

## Stage 10: Critical UI and Component Tests

Objective: Cover UI behavior with meaningful logic: permission-aware controls, inventory scanner states, rental actions, settings user management, loading/empty/error states.

Files affected:

- `package.json` only if a component test dependency is explicitly approved
- `vitest.config.ts`
- `src/app/(admin)/**/__tests__/**`
- `src/test-utils/render/**`

Dependencies:

- Explicit approval before installing any dependency such as `@testing-library/react` or `jsdom`.

Tests introduced:

- Permission controls enabled/disabled by role.
- Inventory scan success/error states.
- Retry behavior preserves operation ID.
- Settings user management form validation.

Expected runtime:

- 1-4 minutes.

Risks:

- Component tests can become brittle if they assert Tailwind classes or layout instead of behavior.

Validation command:

```powershell
npm test
```

Rollback considerations:

- Remove or rewrite brittle snapshots; prefer semantic queries.

## Stage 11: Critical E2E Smoke Tests

Objective: Add a minimal browser smoke suite for the workflows a human would notice immediately.

Files affected:

- `package.json` only with explicit approval for Playwright or equivalent
- `playwright.config.ts` or equivalent
- `tests/e2e/**`

Dependencies:

- Explicit dependency/tool approval.
- Deterministic test auth strategy.
- Emulator or seeded non-production environment.

Tests introduced:

- Login.
- Protected route redirect.
- Dashboard navigation.
- Inventory scanner happy path/error path.
- Rental checkout smoke.

Expected runtime:

- 3-8 minutes.

Risks:

- Browser tests can become slow/flaky.
- Must not use production Firebase or PHI.

Validation command:

```powershell
npm run test:e2e
```

Rollback considerations:

- Keep E2E suite small; demote detailed behavior to unit/integration tests.

## Stage 12: Unified Validation Command

Objective: Add a single command that produces PASS/FAIL/BLOCKED evidence for local and future CI use.

Files affected:

- `scripts/toolkit/toolkit.ps1`
- `scripts/Invoke-ProjectValidation.ps1`
- `package.json`
- `docs/architecture/TESTING.md`

Dependencies:

- Stages 1-11 as available.

Tests introduced:

- Script-level dry-run or parser tests if feasible.

Expected runtime:

- Fast mode: 3-8 minutes.
- Full mode: 15-30 minutes.

Risks:

- A monolithic command can become too slow; support targeted and full modes.

Validation command:

```powershell
.\scripts\toolkit\toolkit.ps1 validate
```

Rollback considerations:

- Keep old script names working while introducing the new command.

## Stage 13: AI Agent Validation Gate

Objective: Require agent-generated changes to report changed files, tests, validation commands, results, known failures, and untested risks.

Files affected:

- `docs/architecture/TESTING.md`
- `.github/pull_request_template.md` if CI/PR workflow later exists
- Agent/runbook docs

Dependencies:

- Stage 12.

Tests introduced:

- None required.

Expected runtime:

- No runtime impact.

Risks:

- Policy without enforcement becomes documentation only.

Validation command:

```powershell
.\scripts\toolkit\toolkit.ps1 validate
```

Rollback considerations:

- Template changes are documentation-only.

## Stage 14: CI-Ready Validation

Objective: Make the local validation architecture runnable in CI without production credentials.

Files affected:

- CI workflow files when requested
- `firebase.json`
- `package.json`
- Validation scripts

Dependencies:

- Stage 12.
- Explicit request before creating CI.

Tests introduced:

- CI smoke validation.

Expected runtime:

- PR fast gate: 8-15 minutes.
- Full/nightly gate: 20-40 minutes.

Risks:

- Emulator port conflicts.
- Secret leakage.
- CI-only flakes if environment differs from local.

Validation command:

```powershell
.\scripts\toolkit\toolkit.ps1 validate -Ci
```

Rollback considerations:

- Keep CI additive until it proves stable; do not remove local commands.

## Recommended First Implementation Stage

Start with **Stage 1: Validation Baseline Repair**.

Reason: the current repo already has useful tests, but the validation boundary cannot be trusted while lint, Functions build/typecheck, and emulator startup are failing or blocked. Fixing those first gives every later stage a measurable foundation.

## First Five Files or Directories To Modify Later

1. `eslint.config.mjs`
2. `functions/src/inventory/receiveScannedInventoryIntake.ts`
3. `firebase.json`
4. `scripts/toolkit/toolkit.ps1`
5. `functions/src/test-utils/`

## Golden Regression Suite Target

Initial target: **24 scenarios**.

Runtime target:

- Fast targeted validation: 2-5 minutes.
- Golden regression validation: 6-12 minutes.
- Full validation with builds and emulators: 15-30 minutes.

## Overall Complexity

Overall implementation complexity is **HIGH**.

The difficulty is not the test runner. The hard parts are reliable emulator orchestration, transaction/idempotency correctness, server-side authorization proof, test data isolation, and avoiding a slow brittle UI suite.
