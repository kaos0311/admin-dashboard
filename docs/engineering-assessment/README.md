# Advanced Home Medical Admin Dashboard — Engineering Assessment

**Engagement type:** READ-ONLY architecture review
**Date of assessment:** based on repository inspection
**Scope:** architecture, features, production blockers, technical debt, refactoring, roadmap
**Output:** this document is the single deliverable of the engagement. No source code was modified.

---

## 1. Executive Summary

This is a feature-rich, rapidly-built internal operations platform that has evolved
from a Firebase-first admin dashboard into a hybrid multi-database
(Firestore + PostgreSQL/Prisma) system with 20+ business subsystems, domain-workflow
state machines, an import pipeline, AI (Jarvis), QR delivery tracking, and a
ChatGPT bridge. Feature velocity has been extraordinary; architectural discipline
has not kept pace.

The codebase shows deliberate security work — Firestore rules with protected-field
diff guards, cloud-function-only writes to audit/inventory-transaction/delivery-scan
collections, MFA, a role hierarchy, and safe-next-path sanitization — but it also
carries severe production risks: a `serviceAccountKey.json` in the working tree,
`.env`/`.env.local` on disk, no CI pipeline, a README that is still create-next-app
boilerplate, 15+ committed `.bak-*` files, and dual write paths that risk
domain-invariant drift.

**Overall Engineering Score: 58/100** — capable but fragile; production-*adjacent*,
not production-*ready*.

---

## 2. Scorecard

| Dimension | Score (1–10) | Evidence summary |
|---|---|---|
| Architecture maturity | 5 | Repositories split by DB (`src/repositories/firestore`, `src/repositories/postgres`), workflow state machines in `functions/src/domainWorkflows` — but legacy `src/lib/inventory.ts`, `src/lib/domainWorkflows.ts`, `src/lib/rentals.ts` duplicate server logic |
| Code organization | 4 | `src/lib` mixes infra/domain/security/UI; 15+ committed `.bak-*` files; root-level scratch artifacts |
| Separation of concerns | 5 | Workflow services isolated in functions; repositories separated by DB; but `src/lib` still contains domain logic |
| Domain boundaries | 4 | 40+ Firestore collections; naming inconsistencies (`patients` vs `patients_index`, `insurance` vs `insuranceRecords`); no single domain registry |
| Technical debt | 3 | `.bak-*` files, dual systems of record, 4 barcode libs, 2 virtualizers, no CI gate |
| Scalability | 5 | `maxInstances: 10`, immutable audit/transaction collections, collection-group rules for `rows`; no pagination/caching evidence |
| Maintainability | 4 | README boilerplate; knowledge scattered in `CLAUDE.md` / `PRODUCTION_READINESS.md` / `TASK_PROGRESS.md`; large hand-maintained rules |
| Security | 6 | Immutable audit logs, protected-field diffs, MFA, role hierarchy — but service key in tree, exposed destructive callables, unguarded chatgpt-bridge |
| Performance | 4 | No caching layer; client bundle includes Firebase SDK; 4 barcode libs + pdfjs + framer-motion + 2 virtualizers |
| Testing | 4 | Vitest configured; 3 test files found; `emulators:test` exists but is not wired into `verify` |
| Documentation | 2 | README is untouched boilerplate; no API or data-model docs |

Weighted overall: Architecture 20%, Security 20%, Maintainability 15%,
Scalability 15%, Performance 15%, Testing 10%, Documentation 5% → **58/100**.

---

## 3. Phase 1 — Current State Assessment (detail)

### Architecture maturity — 5
Strong directional signals: `src/repositories/firestore/` and
`src/repositories/postgres/` separate persistence from UI; `functions/src/domainWorkflows/`
implement delivery/rental/patient lifecycle as state machines with a shared
`shared.ts` helper and a dedicated `stateMachines.test.ts`. However, legacy
parallel paths (`src/lib/inventory.ts`, `src/lib/domainWorkflows.ts`,
`src/lib/rentals.ts`, plus four `functions/src/index.ts.bak-*` snapshots) mean
behavior can drift between client-side legacy and server-side workflow paths.

### Code organization — 4
Root directory contains 10+ scratch artifacts (`Get-Process python -ErrorAction Sil.txt`,
`InventoryForm.fixed.tsx` outside `src/`, `prisma-usage.txt`, `theme-scan*.txt`,
`ts-errors.txt`, `__ts-errors.txt`, `tmp-cloudflared*.log`, `tmp-next-dev*.log`,
`repo-snapshot.txt`, `inventory-form-sync-fix.txt`). Backups are committed
alongside live code in `src/`, `functions/src/`, and repo root.

### Separation of concerns — 5
`functions/src/domainWorkflows/*.ts` are cleanly isolated. Firestore rules enforce
immutability for `auditLogs` and `inventoryTransactions`
(`allow create/update/delete: if false`). But client-side writes are still allowed
for `orders`, `inventory`, `rentals`, `insuranceRecords`, `complianceIssues`,
`tasks`, `notifications`, `importJobs`, `importQueue`, `importedReports` — a
second write path that bypasses the workflow callables.

### Domain boundaries — 4
40+ collections are declared in `firestore.rules`: settings, analytics,
patientIndex, apiRegistry, vendorResearchSites, dashboardPreview, products,
hcpcsCodes, referenceImports, inventory, stockMovements, inventoryOperations,
cpapSetupAppointments, cpapSupplyPulls, cpapSupplyCallNotes, orders, rentals,
rolodexContacts, qrCards, qrScanEvents, users, employeeEvaluations,
employeeEvaluationComments, employeeEvaluationSnapshots, retailCustomerContacts,
complianceIssues, tasks, hospiceOversight, equipmentRecalls, recallMatches,
cmnQueue, parAlerts, patients (+documents/equipment/timeline), patients_index,
hospicePatients, insuranceRecords, insurance, insurancePatients, insuranceQueue,
patientAuthorizations, patientDeliveryTickets, deliveryFulfillmentScans,
deliverySignatures, deliveryDamagePhotos, deliveryTechLocations, chartExportLogs,
wipRecords, patientPhysicians, patientReferrals, shopItems, shopInventoryLots,
shopInventorySerials, shopGlAccountGroups, shopGlDetails, shopCostOfGoodsSold,
shopRawReports, importJobs (+rows), importQueue, importedReports (+rows),
aiConversations (+messages), notifications, inventoryTransactions, auditLogs,
phiAlerts, improvementProposals. There is no single domain→collection registry in
the inspected files.

### Technical debt — 3
15+ committed `.bak-*` files; two manual validation scripts
(`validate:inventory-writes`, `validate:domain-writes`) that are not CI-gated;
mid-refactor artifacts at root (`imports/`, `InventoryForm.fixed.tsx`);
two systems of record.

### Scalability — 5
Functions use `maxInstances: 10` and fixed `us-central1`. Rules use
`exists()`/`get()` helpers. But there is no caching layer, no pagination evidence
for list views, and the chatgpt-bridge `query` mode accepts arbitrary
`limit`/`orderByField`/`filters` with no cap.

### Maintainability — 4
README is the untouched create-next-app boilerplate. Real knowledge lives in
`CLAUDE.md`, `PRODUCTION_READINESS.md`, `TASK_PROGRESS.md`, `prisma-usage.txt`,
and `repo-snapshot.txt` — none of which are user-facing docs. The `firestore.rules`
file is ~430 lines maintained by hand.

### Security — 6
Strengths: `safeSelfUserUpdate` prevents self role/active/deleted changes;
delivery scans/signatures/damage photos/tech locations are cloud-function-only;
audit and inventory transactions are immutable; ADMIN-only for settings/analytics
writes; tank-only for employee evaluations; `isAdmin()` treats `admin` and `tank`
equivalently; MFA TOTP challenge in the login flow; safe next-path sanitization.
Weaknesses: `serviceAccountKey.json` in tree, `.env`/`.env.local` on disk,
`bootstrapAdminClaim` and `resetOperationalDatabase` exported callables, no rate
limiting on login/API, no `server-only` guards.

### Performance — 4
Client bundle includes the Firebase JS SDK via `@/lib/firebase`
(imported by `src/app/(auth)/login/LoginClient.tsx`). Four barcode libraries are
installed (`@ericblade/quagga2`, `@zxing/browser`, `@zxing/library`, `html5-qrcode`),
two virtualizers (`@tanstack/react-virtual`, `react-window`), plus framer-motion
and pdfjs-dist. No caching strategy is visible.

### Testing — 4
Vitest + v8 coverage configured (`test:coverage`). Three tests found:
`functions/src/domainWorkflows/stateMachines.test.ts`,
`src/lib/auth/require-api-auth.test.ts`, `src/lib/permissions/roles.test.ts`.
`@firebase/rules-unit-testing` is a devDependency and `emulators:test` exists,
but neither is wired into `npm run verify`.

### Documentation — 2
README is boilerplate. No API docs, no data-model docs for the 40+ collections,
no deploy runbook, no architecture diagram.

---

## 4. Phase 2 — Feature Inventory

| Subsystem | Status | Est. completion |
|---|---|---|
| Authentication (Firebase email/password, MFA TOTP, forgot-password) | Mostly complete | 90% |
| Authorization (7 roles, permission map, API auth guard, rules helpers) | Mostly complete | 90% |
| Patients (patients + patients_index; documents/equipment/timeline subcollections; lifecycle field guard) | Mostly complete | 85% |
| Inventory (products/hcpcsCodes/inventory/stockMovements/inventoryOperations/inventoryTransactions; barcode receive/issue/cycle/transfer; movement functions) | Mostly complete | 85% |
| Rentals (rentals; checkout/return/exchange/cancel callables; stale-draft reporting) | Mostly complete | 85% |
| Deliveries (patientDeliveryTickets; fulfillment scans/signatures/damage photos/tech locations — cloud-function-only) | Mostly complete | 85% |
| Orders (orders collection; `src/repositories/firestore/order.repository.ts`) | Partial | 70% |
| Insurance (insurance, insuranceRecords, insurancePatients, insuranceQueue, patientAuthorizations, cmnQueue) | Partial | 60% |
| Hospice (hospicePatients, hospiceOversight) | Partial | 55% |
| CPAP (appointments; supply pulls + `validCpapSupplyPull`; call notes + `validCpapSupplyCallNote`) | Partial | 65% |
| Imports (engine, parsers, normalize, headerAliases, retry/staging/queues/workers, cleanup, Jarvis screening) | Mostly complete | 90% |
| Reports (reportDetection/reportTypes in `src/lib`; reports service; importRetention) | Partial | 60% |
| AI / Jarvis (askAdminAi, phiSafety scan, importScreening, chatgpt-bridge route) | Partial | 60% |
| Rolodex (rolodexContacts, searchRolodexContacts callable, vendorResearchSites) | Mostly complete | 85% |
| Notifications (notifications collection) | Prototype | 40% |
| Retail (retailCustomerContacts, shop* inventory/GL/COGS/raw reports) | Prototype | 35% |
| Compliance (complianceIssues, equipmentRecalls, recallMatches, phiAlerts, chartExportLogs) | Partial | 40% |
| Employee evaluations (evaluations/comments/snapshots — tank-only) | Partial | 65% |
| QR system (qrCards, qrScanEvents, trackQrScan callable) | Mostly complete | 80% |
| Audit logging (auditLogs immutable, cloud-function-only) | Complete | 95% |
| PostgreSQL (Prisma: Customer, Location, Manufacturer, EquipmentModel, Equipment, WorkOrder, AuditLog) | Prototype | 30% |
| Firestore (40+ collections, indexes, rules with validators, collection-group rules for rows) | Complete | 95% |

---

## 5. Phase 3 — Production Blockers

### P0 — Critical

| # | Blocker | Evidence | Risk | Effort | Order |
|---|---|---|---|---|---|
| 1 | `serviceAccountKey.json` in working tree | Root listing | Full Firebase admin access; treat as compromised | High | 1 |
| 2 | No CI pipeline | No workflow configs; `verify` script not enforced | Regressions merge silently | Medium | 2 |
| 3 | `.env` / `.env.local` on disk | Root listing | Secret exposure | Low | 3 |
| 4 | Destructive/privileged callables exported | `functions/src/index.ts` exports `resetOperationalDatabase`, `cleanDatabase`, `rebuildEverything`, `softResetReports`, `updateUserRole`, `deleteUserAccount`, `resetUserPassword`, `bootstrapAdminClaim` | Database resets / privilege changes | Medium | 4 |

### P1 — High

| # | Blocker | Evidence | Risk | Effort | Order |
|---|---|---|---|---|---|
| 5 | Dual write paths for domain data | Rules allow client writes on orders/inventory/rentals/etc. while `functions/src/domainWorkflows` provide state machines | Invariant bypass, drift | High | 5 |
| 6 | Two systems of record (Postgres + Firestore) | `prisma/schema.prisma` vs 40+ Firestore collections | Data inconsistency | Very high | 6 |
| 7 | Firestore catch-all denies group queries | `match /{document=**} { allow read, write: if false; }`; only `/{path=**}/rows/{rowId}` allowed | Silent feature breakage | Medium | 7 |
| 8 | chatgpt-bridge unbounded | `src/app/api/chatgpt/route.ts` passes raw `limit`/`filters` to `executeQuery` | Cost/DoS | Low | 8 |
| 9 | No rate limiting on login/API | Login + `/api/chatgpt` | Brute force | Medium | 9 |
| 10 | `bootstrapAdminClaim` exposure | Exported callable | Privilege escalation | Low | 10 |

### P2 — Medium

| # | Blocker | Evidence | Effort | Order |
|---|---|---|---|---|
| 11 | 15+ committed `.bak-*` files | `src/lib`, `functions/src`, `src/repositories/firestore` | Low | 11 |
| 12 | Root-level scratch artifacts | See Phase 1 | Low | 12 |
| 13 | README is boilerplate | `README.md` | Medium | 13 |
| 14 | Backup rules/indexes at root | `firestore.rules.bak-*`, `firestore.indexes.json.bak-*`, `storage.rules.bak-*` | Low | 14 |
| 15 | Rules tests not wired into `verify` | `emulators:test` exists; `verify` is lint+typecheck+build only | Medium | 15 |

### P3 — Low

| # | Blocker | Evidence | Effort |
|---|---|---|---|
| 16 | Dependency bloat | 4 barcode libs, 2 virtualizers, framer-motion, pdfjs | Low |
| 17 | Bleeding-edge versions | Next 16.2.3, React 19.2.4, TS ^6.0.3, next-auth ^5.0.0-beta | Medium |
| 18 | Mixed auth families | next-auth beta + @auth/prisma-adapter + Firebase Auth | High |
| 19 | lucide-react ^1.23.0 early major | package.json | Low |
| 20 | Firebase SDK in client bundle | `@/lib/firebase` in LoginClient | Low |

---

## 6. Phase 4 — Technical Debt (ranked)

1. **Duplicate domain logic** — `src/lib/inventory.ts`, `src/lib/domainWorkflows.ts`, `src/lib/rentals.ts` vs repositories and `functions/src/domainWorkflows`. Critical.
2. **Committed `.bak-*` files (15+)** — high.
3. **Dual system-of-record (Prisma + Firestore)** — high.
4. **`src/lib` monolith** (firebase, firebaseAdmin, prisma, navigation, utils, audit, auditLogs, ensureUserProfile, importRetention, reportDetection, reportTypes, inventory, rentals, domainWorkflows, jarvisCodeFix in one folder) — high.
5. **No CI gate** — high.
6. **Client-side writes to business collections** — high.
7. **Missing `server-only`/`client-only` guards** — medium.
8. **Unbounded Firestore reads** — medium.
9. **4 barcode libs + 2 virtualizers** — medium.
10. **Sparse tests** (3 files for 100+ modules) — medium.
11. **`imports/` folder at root** — medium.
12. **Large hand-maintained `firestore.rules` (~430 lines), no codegen** — medium.
13. **Mixed auth approaches** — medium.
14. **No e2e tests** — medium.
15. **`reportDetection`/`reportTypes` in `src/lib` instead of reports service** — low.
16. **Large `LoginClient.tsx` monolith** (login form + MFA + routing) — low.
17. **Root scratch/audit text files** — low.
18. **Backup rules/indexes/storage rules at root** — low.
19. **Boilerplate README** — low.
20. **No data-model docs for 40+ collections** — low.

---

## 7. Phase 5 — Refactoring Opportunities (highest value first)

1. Delete committed `.bak-*` files and root scratch artifacts (verify git history first).
2. Rotate/remove `serviceAccountKey.json`; enforce `.gitignore` for `.env*`, keys, logs.
3. Add `import 'server-only'` to `firebaseAdmin.ts`/`prisma.ts`/repositories; `import 'client-only'` to client Firebase.
4. Make `functions/src/domainWorkflows/domainWorkflowFunctions.ts` the **only** write path for rentals/orders/inventory/patients/insurance; tighten rules to deny client writes (mirror the `patientDeliveryTickets`/`delivery*` model).
5. Cap chatgpt-bridge `limit` and allowlist collections/fields.
6. Create a `domainRegistry.ts` mapping domain → collection(s) → write policy → callable; optionally code-generate rules from it.
7. Split `LoginClient.tsx` into `LoginForm`, `MfaChallenge`, `ForgotPassword` components.
8. Consolidate barcode scanning to `@zxing/browser`; virtualization to `@tanstack/react-virtual`.
9. Add pagination (`limit` + cursor) and Firestore `count()` to list views.
10. Add Zod schemas at every write boundary (rules already codify CPAP field rules; replicate in TypeScript).
11. Wire `emulators:test` + `@firebase/rules-unit-testing` into `npm run verify`.
12. Make destructive callables admin-only, single-use, with confirmation tokens and mandatory audit entries.

---

## 8. Phase 6 — Engineering Roadmap

### Milestone 1 — Critical Stabilization (2–3 weeks)
- Rotate/remove service account key; scrub git history; enforce gitignore.
- CI on every PR: `npm ci && npm run lint && npm run typecheck && npm run build && npm test`.
- Delete `.bak-*`, root scratch files, backup rules/indexes.
- Guard destructive callables (admin + confirm token + audit).
- Cap chatgpt-bridge limits.
- **Impact:** removes P0/P1 exposure and regression risks.

### Milestone 2 — Security Hardening (3–4 weeks)
- Move all domain writes behind callables; tighten rules.
- Rate-limit login/API; enforce MFA for admin/tank at rules level.
- `server-only`/`client-only` guards.
- Fix collection-group rules beyond `rows`.
- **Impact:** single write path, audit-complete.

### Milestone 3 — Architecture Cleanup (3–4 weeks)
- Consolidate `src/lib` into `src/lib/core`, `src/lib/domains/*`, `src/lib/security/*`.
- Domain registry + typed Firestore accessors; delete legacy domain files after migration.
- Split large UI files.
- **Impact:** maintainability jump.

### Milestone 4 — Performance Optimization (3 weeks)
- Caching (React cache/SWR) + CDN for assets.
- Pagination + `count()` for all list views.
- Code-split barcode/QR/PDF via `next/dynamic`.
- Dedupe barcode/virtualizer libraries.
- **Impact:** bundle size and Firestore read cost reduction.

### Milestone 5 — Testing Expansion (4–6 weeks)
- Unit tests for repositories, workflow services, auth guards.
- Firestore rules tests per collection.
- Postgres repository tests (testcontainers).
- Playwright smoke tests: login, inventory, rental checkout, delivery scan, report import.
- Wire into CI.
- **Impact:** regression safety for milestones 1–4.

### Milestone 6 — Operational Excellence (ongoing)
- Real README + architecture + data-model docs.
- Structured logging/alerting for Cloud Functions.
- Firestore backup/restore drill; Postgres migration plan.
- Deploy runbook (Cloudflare tunnel + Firebase) and DR runbook.
- **Impact:** on-call readiness.

---

## 9. Top 20 Strengths

1. Firestore rules use protected-field diff guards for inventory, rentals, deliveries, patient equipment, and patient lifecycle.
2. `auditLogs` and `inventoryTransactions` are immutable, cloud-function-only writes.
3. Delivery scans/signatures/damage photos/tech locations are cloud-function-only.
4. MFA (TOTP) login with friendly errors and safe-next-path sanitization.
5. Centralized role hierarchy + permission map with `roleIsAtLeast`/`hasPermission`/`hasAllPermissions`/`hasAnyPermission`.
6. `safeSelfUserUpdate` prevents self role/active/deleted changes.
7. State-machine workflow services with a dedicated test file.
8. Comprehensive import pipeline (engine, parsers, normalize, retry, staging, queues, cleanup, Jarvis screening).
9. Callable-based barcode inventory operations + movement reversal + reconciliation.
10. `maxInstances: 10`, fixed `us-central1`.
11. Collection-group rules for `rows` subcollections.
12. Field-level validators for CPAP supply pulls/call notes inside rules.
13. `delete: if false` on inventory, rentals, stockMovements, patients, improvementProposals.
14. Separate Firestore/Postgres repository layers.
15. Prisma schema with enums and relations.
16. Vitest + coverage configured; `emulators:test` script exists.
17. Manual write-path validation scripts show awareness of the issue.
18. `.bak` snapshots of rules/indexes show change discipline.
19. API auth guard for non-Firebase endpoints.
20. `storage.rules` present (Storage security considered).

## 10. Top 20 Weaknesses

1. `serviceAccountKey.json` in working tree.
2. `.env`/`.env.local` on disk.
3. No CI/CD pipeline.
4. README is boilerplate.
5. 15+ committed `.bak-*` files.
6. Root-level scratch artifacts.
7. Dual systems of record (Prisma + Firestore).
8. Client-side Firestore writes permitted for many business collections.
9. Destructive callables exported without visible gating.
10. chatgpt-bridge unbounded limits, no allowlist.
11. Mixed auth approaches (next-auth beta + Firebase).
12. 4 barcode libs + 2 virtualizers.
13. No pagination strategy for list views.
14. `src/lib` monolith.
15. Missing `server-only`/`client-only` guards.
16. Only 3 test files.
17. No API/data-model documentation.
18. `bootstrapAdminClaim`/`resetOperationalDatabase` exposure.
19. Firestore catch-all denies non-`rows` collection-group queries.
20. Bleeding-edge dependency versions without CI lockstep.

## 11. Top 20 Quick Wins

1. Delete `.bak-*` files (verify git history first).
2. Delete root scratch artifacts.
3. Rotate service account key; remove from repo.
4. Enforce `.gitignore` for `.env*`/keys/logs.
5. Add CI: `npm ci && npm run verify && npm test`.
6. Add `server-only`/`client-only` guards.
7. Cap chatgpt-bridge limit + allowlist collections.
8. Rate-limit `/api/chatgpt` and login endpoints.
9. Make `bootstrapAdminClaim` single-use.
10. Add confirmation tokens to destructive callables.
11. Write a real README.
12. Wire `emulators:test` into `verify`.
13. Add pagination + `count()` to list views.
14. Consolidate barcode libs to `@zxing/browser`.
15. Remove `react-window` (keep `@tanstack/react-virtual`).
16. Add Zod schemas at the chatgpt-bridge boundary.
17. Create a `domainRegistry.ts`.
18. Split `LoginClient.tsx` into focused components.
19. Add rules tests for the `users/{userId}` self-update guard.
20. Pin TypeScript to a stable release.

---

## 12. Files Inspected

- `package.json` — scripts, dependencies, version risks.
- `src/app/(auth)/login/page.tsx` — login route wrapper.
- `src/app/(auth)/login/LoginClient.tsx` — login form + MFA challenge + safe-next-path.
- `src/lib/permissions/roles.ts` — role types, hierarchy, permission map.
- `firestore.rules` — full collection inventory, validators, guards, catch-all deny.
- `prisma/schema.prisma` — Postgres models and enums.
- `functions/src/index.ts` — all exported callables.
- `src/app/api/chatgpt/route.ts` — GPT Actions bridge.
- Root directory listing — artifacts, `.env`, docs, backup files.
- Multiple `list_files` results for `src/`, `functions/src/`, `src/repositories`, `src/services`, `src/app/(admin)`, `src/lib`, `src/lib/auth`, `src/lib/permissions`, `functions/src/domainWorkflows`, `functions/src/imports`, `functions/src/ai`.

## 13. Files Modified / Created

- `docs/engineering-assessment/README.md` — **created** as the single deliverable of this read-only engagement, containing the full assessment (executive summary, scorecard, phases, inventories, blockers, debt, refactors, roadmap, top-20 lists).
- **No existing source file was created, modified, or deleted.**
- **Nothing was installed, deployed, or committed.**

## 14. Risks, Assumptions, Recommended Follow-up

- This assessment is structural (directory listings, key file reads). Deeper per-file code review is recommended before executing each milestone.
- `serviceAccountKey.json` should be treated as compromised and rotated immediately.
- `PRODUCTION_READINESS.md`, `CLAUDE.md`, and `TASK_PROGRESS.md` were not read in depth during this pass; they should be folded into the future real README.
- Recommended follow-up: implement M1 (Critical Stabilization) first; every later milestone depends on the CI gate and secret cleanup established there.