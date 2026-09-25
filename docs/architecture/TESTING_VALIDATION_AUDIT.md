# AHM Dashboard Testing, Validation, and Regression Audit

Date: 2026-08-07

## 1. Executive Summary

Current testing maturity is **MODERATE for low-level helper/auth/static-validator coverage and LOW for whole-application regression safety**.

The repository has meaningful validation infrastructure: Vitest at the Next.js app root, a separate Vitest setup for Cloud Functions, emulator-oriented tests for inventory receive/idempotency, static write validators for protected inventory/domain writes, TypeScript checks, production builds, and a PowerShell toolkit. Current non-emulator tests pass:

| Command | Current result |
|---|---:|
| `npm test` | PASS, 21 files / 411 tests |
| `cd functions; npm test` | PASS, 4 files / 21 tests |
| `npm run validate:inventory-writes` | PASS |
| `npm run validate:domain-writes` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |

The safety boundary is not yet production-grade for AI-agent changes because important gates are either missing from the unified path or currently failing:

| Command | Current result |
|---|---|
| `npm run lint` | FAIL: ESLint scans `.codex-backups/` and `tmp/`, causing 7 errors and many warnings |
| `cd functions; npx tsc --noEmit` | FAIL: `functions/src/inventory/receiveScannedInventoryIntake.ts` type errors |
| `cd functions; npm run build` | FAIL: same Functions TypeScript errors |
| `npm run emulators:test` | BLOCKED: Firestore emulator port `127.0.0.1:8080` already in use |

The highest-risk currently unprotected behaviors are transactional inventory movements, domain workflow idempotency, callable authorization, user-management callables, UI permission behavior, and real user workflows such as login, scan, checkout, return, exchange, delivery, and import processing.

## 2. Current Test Infrastructure

Root app tests are configured in `vitest.config.ts`:

- Runner: Vitest 4.
- Environment: `node`.
- Includes: `src/**/*.test.ts` and `src/**/*.test.tsx`.
- Excludes: `functions`, `scripts`, and `node_modules`.
- Setup: `src/test-utils/setup.ts`.
- Coverage provider: V8.
- Coverage include is currently only `src/lib/permissions/roles.ts`.

Functions tests are configured in `functions/vitest.config.ts`:

- Runner: Vitest 4.
- Environment: `node`.
- Includes: `functions/src/**/*.test.ts`.
- Excludes: `functions/lib`, `node_modules`, and `*.emulator.test.ts`.

Functions integration/emulator tests are configured in `functions/vitest.integration.config.ts`:

- Includes: `functions/src/test-utils/**/*.integration.test.ts` and `functions/src/test-utils/**/*.emulator.test.ts`.
- Timeout: 30 seconds.
- Sets `FIRESTORE_EMULATOR_HOST=localhost:8080`, `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`, and `GCLOUD_PROJECT=demo-advanced-home-medical`.

Current test files by area:

| Area | Evidence |
|---|---|
| Smoke | `src/test-utils/smoke.test.ts` |
| Auth/session/API auth | `src/lib/auth/*.test.ts`, `src/lib/permissions/roles.test.ts` |
| Rate limiting | `src/lib/security/rate-limit.test.ts`, `functions/src/security/rateLimit.test.ts` |
| Firebase Admin init | `src/lib/firebaseAdmin.test.ts` |
| API routes | `src/app/api/chatgpt/route.test.ts`, `src/app/api/improvements/route.e2e.test.ts` |
| Barcode and receive inventory contracts | `src/lib/__tests__/barcode*.test.ts`, `receive-inventory*.test.ts` |
| Static write validators | `src/lib/__tests__/inventory-write-validation.test.ts`, `domain-write-validation.test.ts` |
| Runtime protected field guards | `src/lib/inventory/protectedFields.test.ts`, `src/lib/__tests__/domain-protected-fields.test.ts` |
| Repository/service units | `src/repositories/firestore/inventory.repository.test.ts`, `src/services/inventory/inventory-scan-resolver.test.ts` |
| Functions domain state machines | `functions/src/domainWorkflows/stateMachines.test.ts` |
| Functions movement scan safety | `functions/src/inventory/movementService.test.ts` |
| Emulator safety and inventory receive | `functions/src/test-utils/emulator-setup.test.ts`, `receive-inventory.emulator.test.ts` |

There is no installed top-level Playwright/Cypress/JSDOM/React Testing Library setup in `package.json`. `package-lock.json` contains transitive references, but no root script or config makes this an active E2E or component-testing stack.

## 3. Current Validation Toolkit

Root npm scripts:

| Script | What it does |
|---|---|
| `lint` | Runs `eslint` over configured files |
| `typecheck` | Runs `tsc --noEmit` for the root app |
| `build` | Runs `next build` |
| `test` | Runs root Vitest suite |
| `test:coverage` | Runs root Vitest with coverage |
| `verify` | Runs `lint`, `typecheck`, and `build`; does not run tests or Functions checks |
| `validate:inventory-writes` | Runs static protected inventory write validator |
| `validate:domain-writes` | Runs static protected domain workflow write validator |
| `emulators:test` | Runs Functions emulator test command |

Functions npm scripts:

| Script | What it does |
|---|---|
| `build` | Runs Functions `tsc` |
| `rebuild` | Cleans `lib` and builds |
| `test` | Runs Functions unit Vitest suite |
| `test:integration` | Runs emulator/integration Vitest config |
| `test:emulator` | Starts Firestore/Auth emulators, then runs integration tests |

PowerShell tooling:

| Script | Current role |
|---|---|
| `scripts/toolkit/toolkit.ps1` | Unified entry point for lint, typecheck, build, functions build, health, release, and all |
| `scripts/toolkit/lint.ps1` | Root lint; optionally Functions lint |
| `scripts/toolkit/typecheck.ps1` | Root typecheck and Functions typecheck |
| `scripts/toolkit/build.ps1` | Next build; installs dependencies if `node_modules` is missing |
| `scripts/toolkit/build-functions.ps1` | Functions clean build; installs dependencies if missing |
| `scripts/toolkit/release-readiness.ps1` | Git, lint, typecheck, build, functions build, tests, dependency audit |
| `scripts/Invoke-ProjectValidation.ps1` | Core pipeline: lint, typecheck, build, functions build |
| `scripts/Get-ProjectHealth.ps1` | Read-only health report |
| `scripts/Get-ReleaseReadiness.ps1` | Release gate around clean tree and project validation |

Toolkit gaps:

- No first-class `validate` command.
- Existing root `verify` omits tests, Functions tests/build, static write validators, Firebase rules compilation, Storage rules compilation, and emulator tests.
- Toolkit `all` omits tests and static write validators.
- Current lint config scans backup and temp directories, causing failed lint in a dirty working tree.
- Functions build/typecheck currently fails.

## 4. Application Test Surface

| Layer | Examples | Current automated protection |
|---|---|---|
| UI pages/components | login, dashboard, settings, inventory, rentals, reports, patients | Very low; no active component test stack |
| Hooks | `useAuthRole`, `useInventoryActions`, `useRentals`, report hooks | Low; some behavior indirectly covered, most hooks untested |
| Client libraries | auth/session, Firebase Admin init, domain callable wrappers, inventory client operation IDs | Moderate for auth/session and receive inventory client contracts |
| API routes | `/api/auth/session`, `/api/chatgpt`, `/api/improvements`, `/api/equipment`, Jarvis routes | Moderate for auth/session helpers, chatgpt rate limit, improvements route; low for equipment/Jarvis |
| Firebase callables | admin users, inventory, movement, domain workflows, AI/import maintenance | Low to moderate; receive inventory has emulator coverage, many callables untested |
| Domain workflows | rental, delivery, patient lifecycle, patient equipment | Low; state-machine unit tests exist but full transactional workflow tests are missing |
| Services | inventory scan resolver, Jarvis services, report/import services | Low; scan resolver covered, most services untested |
| Repositories | Firestore inventory/product/order, Postgres repositories | Low; inventory repository mocked unit tests exist; most repositories lack integration tests |
| Firestore/Auth/Storage | rules, transactions, custom claims, Storage paths | Low; emulator utility exists, but rules and Storage workflows are not fully covered |

## 5. Critical Business Workflows

| Workflow | Impact | Current coverage |
|---|---|---|
| Login, logout, session creation/removal, auth state restoration | CRITICAL | Session/API helper tests exist; browser workflow and UI states untested |
| Role handling and protected routes | CRITICAL | Role helper and server guard tests exist; route/UI permission behavior untested |
| Create/update/disable/enable/delete user, reset password | CRITICAL | Callable source exists; no focused callable integration suite found |
| Inventory scan lookup | HIGH | Barcode parsing, lookup shape, scan resolver, repository lookup tests exist |
| Inventory receive by barcode | CRITICAL | Strongest area: unit contracts and emulator test suite exist, but emulator currently blocked locally |
| Product creation/merge/duplicate handling | HIGH | Partial product/repository static coverage; no complete workflow regression suite |
| Inventory movements/location/quantity/serialized equipment | CRITICAL | Movement scan safety unit tests and static validators exist; full transaction scenarios are not fully covered |
| Rental create checked-out/return/exchange/cancel | CRITICAL | Static validators and state-machine tests exist; transactional workflow integration tests are missing |
| Patient equipment assign/remove/transfer/replace/lost/damaged/return | CRITICAL | Static validators and workflow code exist; full integration coverage missing |
| Firestore rules and protected writes | CRITICAL | Static source validators exist; rules-unit-testing coverage is not complete |
| Storage workflows for delivery signatures/damage photos/patient docs | HIGH | Storage rules present; automated Storage emulator tests not found |
| Dashboard navigation/loading/empty/error states | MEDIUM | No active component or E2E test suite found |
| Permission-based UI controls | HIGH | Mostly untested at UI level |

## 6. Current Coverage Gaps

Ranked gaps:

| Rank | Severity | Gap |
|---:|---|---|
| 1 | CRITICAL | No passing unified validation gate that includes lint, root tests, Functions tests, builds, static validators, and emulator checks |
| 2 | CRITICAL | Functions build/typecheck currently fails in `receiveScannedInventoryIntake.ts` |
| 3 | CRITICAL | Emulator suite exists but is currently blocked by port 8080 conflict |
| 4 | CRITICAL | Transactional inventory movement invariants lack a broad emulator regression suite |
| 5 | CRITICAL | Rental and patient-equipment atomic workflow callables lack end-to-end transactional tests |
| 6 | HIGH | Admin user-management callables lack focused authorization and state-change tests |
| 7 | HIGH | Firestore rules tests are not a comprehensive suite despite `@firebase/rules-unit-testing` being installed |
| 8 | HIGH | No active UI/component test stack for permission controls, loading/error/empty states, or critical forms |
| 9 | HIGH | No browser E2E smoke suite for login, inventory scan, rental checkout, and dashboard navigation |
| 10 | HIGH | Coverage config only tracks `src/lib/permissions/roles.ts`, making coverage reports misleading for the whole app |

## 7. Inventory Regression Matrix

| Scenario | Expected behavior | Best layer | Required mock/emulator | Severity |
|---|---|---|---|---|
| Known barcode scanned | Resolves exact inventory/product match and preserves normalized scan | Unit + repository integration | Mock repo for unit; Firestore emulator for query semantics | HIGH |
| Unknown barcode scanned | Creates/resolves pending workflow without stock mutation | Service + emulator | Firestore emulator | HIGH |
| Duplicate barcode scanned | Returns duplicate/ambiguous result and writes no movement | Service + emulator | Firestore emulator | CRITICAL |
| Existing product scanned | Links scan to product or product-derived inventory path | Repository + service | Firestore emulator | HIGH |
| Pending scan created | Writes synthetic pending scan with actor/time metadata | Emulator | Firestore emulator | HIGH |
| Pending scan resolved | Converts pending scan into product/inventory linkage once | Emulator | Firestore emulator | HIGH |
| Product created from scan | Creates product metadata only; no unauthorized inventory quantity mutation | Unit + emulator | Mock repo plus Firestore emulator | HIGH |
| Product merged | Canonical product remains, duplicates map, audit emitted | Integration | Firestore emulator | HIGH |
| Movement created | Movement, inventory counters, transaction, audit, operation record are atomic | Emulator | Firestore emulator | CRITICAL |
| Duplicate movement attempted | Same key returns prior result or conflict without double mutation | Emulator/concurrency | Firestore emulator | CRITICAL |
| Movement retried | Retry after retryable failure is deterministic | Emulator | Firestore emulator with injected failure seam | CRITICAL |
| Idempotency key reused | Same operation same fingerprint does not execute twice | Emulator | Firestore emulator | CRITICAL |
| Quantity increased | `quantityOnHand` and derived fields update consistently | Emulator | Firestore emulator | CRITICAL |
| Quantity decreased | Counters cannot violate domain rules | Emulator | Firestore emulator | CRITICAL |
| Quantity reaches zero | Status/available semantics remain valid and visible | Emulator + component | Firestore emulator; UI mock | HIGH |
| Invalid quantity | Rejects with controlled domain error and no writes | Unit + emulator | Mock plus emulator | HIGH |
| Invalid location | Rejects with controlled error and no writes | Unit + emulator | Mock plus emulator | HIGH |
| Serialized equipment moved | Serial identity remains unique and location/patient state is consistent | Emulator | Firestore emulator | CRITICAL |
| Concurrent movement attempts | Exactly one logical mutation per idempotent operation; no counter drift | Emulator/concurrency | Firestore emulator | CRITICAL |
| Firestore transaction failure | Rolls back all writes and exposes retryable/terminal classification | Emulator | Firestore emulator with fault injection | CRITICAL |
| Network interruption | Client preserves operation ID for retry | Unit + component | Mock callable | HIGH |
| Operation retried after failure | Retry behavior follows terminal vs retryable error rules | Unit + emulator | Mock callable and emulator | HIGH |
| UI successful response | Shows final quantity/result and clears pending operation ID | Component | Mock callable | HIGH |
| UI domain error | Shows actionable message, no success state | Component | Mock callable | HIGH |
| UI unexpected server error | Shows generic error, preserves retry path if appropriate | Component | Mock callable | HIGH |

## 8. Authorization Regression Matrix

| Scenario | Expected behavior | Best layer | Severity |
|---|---|---|---|
| Unauthenticated request | Callable/API rejects with `unauthenticated` or 401; no writes | Unit + emulator/callable | CRITICAL |
| Admin request | Permitted for admin-only operations; writes audited | Callable integration | CRITICAL |
| Staff request | Permitted only for staff-safe operations | Callable integration | HIGH |
| Tank request | Treated according to role map and admin-equivalent rules where intended | Unit + integration | HIGH |
| Disabled user | Denied at server boundary and no writes | Unit + callable integration | CRITICAL |
| Deleted user | Denied at server boundary and no writes | Unit + callable integration | CRITICAL |
| Missing Firestore profile | Denied even if token verifies | Unit + callable integration | CRITICAL |
| Invalid custom claim | Does not override invalid/missing Firestore role | Unit + callable integration | HIGH |
| Stale custom claim | Firestore profile is authoritative where designed | Unit + integration | HIGH |
| Role mismatch | Explicit precedence rules are enforced | Unit + integration | HIGH |
| Unauthorized callable invocation | `permission-denied`, no partial writes | Callable integration | CRITICAL |
| Authorized callable invocation | Performs expected mutation and audit only | Callable integration | CRITICAL |
| Client attempts role escalation | Firestore rules/callables reject self or unauthorized role writes | Rules + callable integration | CRITICAL |

## 9. Firebase Emulator Recommendation

Adopt the Firebase Emulator Suite as a required part of the golden regression suite for behavior where Firebase semantics matter.

Use emulators for:

- Firestore transactions.
- Callable workflow behavior.
- Security rules.
- Auth lifecycle and disabled/deleted/missing profile checks.
- Custom claims and role/profile mismatch cases.
- Concurrent writes and idempotency.
- Storage path validation for workflow-pending vs final patient documents.

Use mocks for:

- Pure helper logic.
- Request validation.
- Client operation ID lifecycle.
- UI rendering states around a mocked callable/repository.
- Error mapping and formatting.

Current emulator state:

- `firebase.json` defines Firestore and Auth emulators.
- Functions and Storage emulators are not configured in `firebase.json`.
- `npm run emulators:test` currently starts Auth/Firestore only.
- The local run was blocked because Firestore emulator port `127.0.0.1:8080` was already taken.

## 10. Transaction Testing Strategy

Transaction-heavy code includes inventory movement services, receive inventory, domain workflows, rate limiting, rental workflows, patient equipment workflows, delivery workflows, and patient lifecycle workflows.

`createInventoryMovementInTransaction` must have emulator-backed tests for:

- Success transaction.
- Missing inventory item.
- Missing product/item references.
- Invalid state before write.
- Invalid movement type or quantity.
- Failed transaction rollback.
- Concurrent movement attempts.
- Duplicate operation ID with same fingerprint.
- Duplicate operation ID with conflicting fingerprint.
- Idempotent response shape.
- Audit and inventory transaction creation.
- Counter invariants before and after movement.

Always-true invariants:

- No inventory movement may change counters without an operation record.
- No duplicate operation ID for the same actor may mutate inventory twice.
- Conflicting reuse of an operation ID must fail closed.
- Movement document, inventory counters, inventory transaction, audit entry, and workflow linkage must commit or roll back together.
- Derived inventory state must not become incoherent with `quantityOnHand`, `available`, `onRent`, `onTruck`, `committed`, or patient/rental assignment fields.
- Serialized equipment must not be assigned to two active owners/locations at once.
- Domain workflows must not create rental/patient-equipment/timeline/audit state without the corresponding movement when movement is required.

## 11. Idempotency Testing Strategy

Observed patterns:

- Client inventory receive uses an operation ID lifecycle manager and requires operation IDs for receive requests.
- Inventory and domain workflow operations persist operation records using actor plus operation ID.
- Fingerprints are used to detect conflicting reuse.
- Domain workflows persist records in `domainWorkflowOperations`; inventory workflows use `inventoryOperations`.

Required tests:

| Case | Expected proof |
|---|---|
| Same operation + same key | Only one mutation occurs; duplicate returns stored result |
| Same key + different request | Rejects with controlled conflict error |
| Failed operation + retry | Retry behavior is documented and deterministic |
| Different operation + different key | Executes normally |
| Concurrent duplicate requests | One logical operation occurs |
| Operation record write succeeds but later write fails | Entire transaction rolls back or state is explicitly recoverable |
| Expiration behavior | If no expiration exists, document that operation records are retained indefinitely or add explicit expiry later |

## 12. Error-Path Testing Strategy

Critical workflows need explicit failure-path tests, not just success tests:

| Error | Required verification |
|---|---|
| Firestore unavailable | Operation fails closed, no fake success |
| Callable throws | UI and caller receive controlled error |
| `permission-denied` | No writes; user-visible permission message |
| `unauthenticated` | No writes; login/session recovery path |
| `invalid-argument` | Field-specific/domain-specific message when safe |
| `not-found` | No partial writes |
| `already-exists`/duplicate | Idempotency conflict or duplicate state is clear |
| Transaction conflict | Retry/terminal behavior is deterministic |
| Network timeout | Client preserves operation ID when retryable |
| Malformed request | Reject before transaction writes |
| Unexpected server error | Generic user message, detailed server log without secrets/PHI |

## 13. Test Data Architecture

Create deterministic synthetic factories under future test utility directories:

| Factory | Required traits |
|---|---|
| User | UID, email, role, active/disabled/deleted flags, claims |
| Admin | Admin role, valid profile |
| Staff | Staff role, valid profile |
| Tank user | Tank role, admin-equivalent test cases |
| Product | ID, barcode fields, HCPCS, manufacturer/model |
| Inventory item | Quantity fields, location, serial, product link |
| Location | Warehouse/truck/patient/location IDs |
| Serialized equipment | Serial number and active assignment state |
| Pending scan | Scan value, source, actor, status |
| Inventory movement | Movement type, quantity, actor, operation ID |
| Idempotency record | Actor, operation ID, fingerprint, stored result |
| Rental | Draft, checked-out, overdue, returned states |
| Patient equipment | Active/closed/lost/damaged/replaced states |

Rules:

- Use synthetic healthcare data only.
- Do not copy production PHI.
- Prefer fixed IDs and fixed timestamps.
- Centralize role/profile defaults.
- Provide builders that make invalid states explicit.

## 14. Isolation Strategy

Every test must be independently repeatable:

- Use `demo-*` Firebase project IDs for emulator tests.
- Reset emulator state before or after each test suite.
- Generate unique deterministic IDs per test.
- Freeze time for operation records, audit entries, and timeline tests.
- Seed only the documents required by the test.
- Avoid dependence on test order.
- Avoid production Firebase credentials in emulator tests.
- Fail immediately if `FIRESTORE_EMULATOR_HOST` or `FIREBASE_AUTH_EMULATOR_HOST` points to a nonlocal host.
- Keep root unit tests independent of emulator availability.

## 15. AI Agent Validation Policy

Every agent-generated change should report:

```text
VALIDATION STATUS: PASS | FAIL | BLOCKED

Files changed:
Tests added:
Tests modified:
Validation commands run:
Lint:
Typecheck:
Unit tests:
Integration tests:
Functions build:
Next build:
Known failures:
Untested risks:
```

Rules:

- Skipped validation is never PASS.
- A blocked command must name the blocking condition.
- Existing unrelated failures must be reported separately from failures introduced by the change.
- Agent reports must include command evidence, not "everything works".
- For inventory/auth/domain workflow changes, the agent must run at least the relevant targeted tests plus static write validators.

## 16. Unified Validation Pipeline

Recommended future command:

```powershell
.\scripts\toolkit\toolkit.ps1 validate
```

Recommended sequence:

1. Health preflight.
2. Root lint.
3. Root typecheck.
4. Static inventory write validator.
5. Static domain write validator.
6. Root unit tests.
7. Functions unit tests.
8. Functions typecheck/build.
9. Firestore rules compile/test.
10. Storage rules compile/test.
11. Emulator integration tests.
12. Next build.
13. Optional E2E smoke tests.
14. Release readiness summary.

This should be implemented later as an additive wrapper around existing scripts, not by weakening existing validators.

## 17. Change-Based Validation

Full validation must remain available. A future change selector can choose minimum targeted gates:

| Changed files | Minimum targeted validation |
|---|---|
| `src/lib/auth/**`, `src/app/api/auth/**` | Auth unit tests, root tests, typecheck |
| `src/lib/permissions/**` | Role tests, auth guard tests, typecheck |
| `src/repositories/**` | Repository unit/integration tests, root tests |
| `src/services/**` | Service tests plus dependent repository tests |
| `functions/src/inventory/**` | Functions tests, Functions build, emulator inventory suite, inventory write validator |
| `functions/src/domainWorkflows/**` | State-machine tests, workflow emulator tests, domain write validator |
| `functions/src/admin*.ts` | Callable authorization integration tests |
| `firestore.rules` | Rules unit tests and emulator smoke |
| `storage.rules` | Storage rules emulator tests |
| `src/app/(admin)/inventory/**` | Inventory unit tests, relevant component tests, golden smoke |
| `src/app/(auth)/**` | Auth/session tests and login E2E smoke |
| `package.json`, lockfiles, config | Full validation |

## 18. Coverage Strategy

Do not optimize for a vanity percentage. Current coverage is scoped only to `src/lib/permissions/roles.ts`, so coverage output does not represent application risk.

Recommended coverage expectations:

| Code | Expectation |
|---|---|
| Critical domain logic | High behavioral coverage |
| Transactional workflow services | High emulator-backed coverage |
| Repositories | High integration coverage |
| Auth/authorization | High unit and integration coverage |
| Static validators | High fixture coverage |
| UI permission controls | Focused component coverage |
| Presentational components | Lower priority |
| Generated/build output/config snapshots | Exclude or low priority |

Meaningful uncovered behavior to track:

- Inventory counter invariants.
- Workflow idempotency.
- Role/profile/claim mismatch.
- Permission-denied UI states.
- Firestore rule denials.
- Storage path denials.
- Concurrent transactions.

## 19. CI Readiness

No active CI workflow was found in the inspected repository paths. The architecture should be CI-ready later.

CI requirements:

- `npm ci` in root and `functions`.
- Java available for Firebase emulators.
- Stable Firebase CLI version.
- Emulator ports either fixed and reserved or dynamically configured.
- No production service account credentials for emulator tests.
- Secret injection only for tests requiring non-emulated external services; most regression tests should not need secrets.
- Artifacts: test reports, coverage reports, build logs.
- Separate fast PR gate from slower nightly/full emulator gate.

## 20. Highest-Risk Untested Behaviors

| Severity | Behavior |
|---|---|
| CRITICAL | Inventory movement transaction rollback and counter invariants |
| CRITICAL | Rental checkout/return/exchange atomicity across rental, movement, patient equipment, timeline, audit, and idempotency |
| CRITICAL | Patient equipment workflow atomicity |
| CRITICAL | Admin user-management callable authorization and last-admin safeguards |
| CRITICAL | Firestore rules enforcing protected domain and inventory fields |
| HIGH | Storage workflow paths for signatures/damage photos/patient documents |
| HIGH | Permission-based UI controls not exposing actions to unauthorized roles |
| HIGH | Login/auth state restoration and protected-route redirect behavior |
| HIGH | Operation ID lifecycle under network interruption |
| HIGH | Functions build/typecheck drift |

## 21. Files Likely To Change

Do not change these during this audit. These are likely future implementation targets:

- `package.json`
- `vitest.config.ts`
- `functions/vitest.config.ts`
- `functions/vitest.integration.config.ts`
- `firebase.json`
- `scripts/toolkit/toolkit.ps1`
- `scripts/Invoke-ProjectValidation.ps1`
- `src/test-utils/**`
- `functions/src/test-utils/**`
- `functions/src/inventory/*.test.ts`
- `functions/src/domainWorkflows/*.test.ts`
- `src/app/(admin)/**/__tests__/**`
- `firestore.rules`
- `storage.rules`

## 22. Recommended Implementation Order

1. Fix current validation blockers without broad refactors: lint ignore scope, Functions type errors, emulator port/runbook.
2. Add shared factories and emulator reset helpers.
3. Expand pure unit coverage for domain helpers and client operation ID behavior.
4. Build inventory movement emulator regression suite.
5. Build authorization/callable integration suite.
6. Add Firestore rules tests.
7. Add Storage workflow tests.
8. Add focused component tests for permission-aware controls and critical forms.
9. Add 10-30 scenario Golden Regression Suite.
10. Add unified validation command.
11. Add AI agent validation report template.
12. Make CI run the same commands.

## Golden Regression Suite

Target size: **24 scenarios**.

| # | Workflow | Layer | Expected result | Severity |
|---:|---|---|---|---|
| 1 | Login/session create | API/helper + E2E | Active user gets session and reaches dashboard | CRITICAL |
| 2 | Disabled user login/session | API/helper + E2E | Denied, no protected UI | CRITICAL |
| 3 | Role permission map | Unit | Every role has intended permissions | CRITICAL |
| 4 | Protected route | E2E | Unauthenticated user redirects to login | CRITICAL |
| 5 | Admin creates user | Callable integration | Auth user/profile/audit created | CRITICAL |
| 6 | Staff attempts admin action | Callable integration | `permission-denied`, no write | CRITICAL |
| 7 | Known scan lookup | Service/repository | Correct item returned | HIGH |
| 8 | Duplicate scan lookup | Service/repository | Ambiguous result, no mutation | CRITICAL |
| 9 | Receive inventory success | Emulator | Counter + transaction + operation record written once | CRITICAL |
| 10 | Receive inventory retry | Emulator | Same result, no double count | CRITICAL |
| 11 | Receive conflicting operation key | Emulator | Controlled conflict, no mutation | CRITICAL |
| 12 | Create movement success | Emulator | Movement/counters/audit/transaction atomic | CRITICAL |
| 13 | Concurrent movement duplicate | Emulator | One logical mutation | CRITICAL |
| 14 | Invalid movement quantity | Unit + emulator | Rejects, no writes | HIGH |
| 15 | Rental create checked-out | Emulator/callable | Rental, movement, patient equipment, timeline, audit, operation record atomic | CRITICAL |
| 16 | Rental exchange | Emulator/callable | Return + checkout sides both consistent | CRITICAL |
| 17 | Patient equipment assignment | Emulator/callable | Assignment, movement, timeline, audit atomic | CRITICAL |
| 18 | Delivery scan | Emulator/callable | Fulfillment line and movement update correctly | HIGH |
| 19 | Firestore protected inventory write | Rules/static | Unauthorized direct counter write denied/caught | CRITICAL |
| 20 | Firestore protected domain write | Rules/static | Unauthorized workflow field write denied/caught | CRITICAL |
| 21 | Storage signature path | Storage emulator | Only pending workflow path allowed before callable finalization | HIGH |
| 22 | Inventory UI success | Component | User sees final quantity/result and operation clears | HIGH |
| 23 | Inventory UI permission denied | Component | Action disabled or error visible with no success state | HIGH |
| 24 | Dashboard navigation smoke | E2E | Core pages load without auth/permission regressions | HIGH |

Estimated runtime after implementation:

- Fast local targeted suite: 2-5 minutes.
- Golden suite with emulators and limited E2E: 6-12 minutes.
- Full validation including builds and full emulator suite: 15-30 minutes.

