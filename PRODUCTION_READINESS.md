# Production Readiness Audit — Advanced Home Medical Dashboard

**Audit Type:** Hostile Production Readiness Review  
**Auditor:** Principal Architect  
**Date:** July 10, 2026  
**Target Deployment:** 30 days  

---

## 1. Executive Summary

This application is a Next.js 16 / Firebase / Prisma (PostgreSQL) admin dashboard for a Durable Medical Equipment (DME) company. It manages patients, orders, inventory, rentals, insurance, hospice care, CPAP compliance, employee evaluations, and an AI-powered product enrichment pipeline. The codebase is substantial (~300+ source files) with a dual-database architecture (Firestore for operational/realtime data, PostgreSQL via Prisma for structured inventory).

**The application is not production-ready in its current state.** While the architectural intent is sound (layered separation documented in `v2-architecture.md`), the implementation is riddled with critical security vulnerabilities, missing error handling, zero tests, and deeply concerning authorization bypasses. Several issues would result in regulatory non-compliance under HIPAA, data loss scenarios, and unauthorized access to PHI.

**Overall Production Readiness Score: 22/100**

---

## 2. Top 20 Production Risks Ranked by Severity

| # | Risk | Severity | Category |
|---|------|----------|----------|
| 1 | **`requireUser()` is a hardcoded development bypass** — returns a fake admin user with no real auth check. Every page using this has zero auth. Exists in production build path. | CRITICAL 10/10 | Auth |
| 2 | **Firebase API key exposed in client bundle** — plaintext API key in `firebase.ts`. While Firebase API keys are somewhat public by design, combined with permissive Firestore rules and no App Check enforcement in all environments, this enables unauthorized Firestore access. | CRITICAL 9/10 | Security |
| 3 | **No CSRF protection** — Next.js API routes accept POST/PATCH with `Bearer` token only. No CSRF token, no SameSite cookie validation, no origin/referrer checking. | CRITICAL 9/10 | Security |
| 4 | **Zero audit trail on PHI-modifying operations** — client-side write operations to patients, orders, rentals happen directly from the browser with audit calls being optional (try/catch swallowed). Critical HIPAA requirement not met. | CRITICAL 9/10 | Compliance |
| 5 | **`serviceAccountKey.json` loaded at runtime from filesystem** — the file is in `.gitignore` but `firebaseAdmin.ts` does a blocking `readFileSync` with no handling if the file is missing. Production deployment will crash immediately if file is absent or permissions wrong. | CRITICAL 8/10 | DevOps |
| 6 | **No rate limiting on any API route** — login, password reset, API endpoints have zero rate limiting. Brute-force attack vector is wide open. | HIGH 8/10 | Security |
| 7 | **API routes inconsistent auth check ordering** — `improvements/route.ts` reads request body JSON *before* auth check, making it vulnerable to parsing-based DoS and information disclosure. | HIGH 8/10 | Security |
| 8 | **ChatGPT Bridge — unversioned API key in env var, no audit logging** — `CHATGPT_API_KEY` provides unfiltered read access to Firestore collections. No logging of queries performed, no row-level filtering, no PII masking. | HIGH 8/10 | Security |
| 9 | **Inventory allocation functions lack transactions** — `allocateInventoryToOrder`, `restoreInventoryFromOrder` run in Firestore with no transaction or batch. Concurrent requests cause double-allocation or negative inventory. | HIGH 7/10 | Reliability |
| 10 | **`buildComplianceIssues.ts` is just string literals** — file contains `"missing_cmn"`, `"expired_par"`, `"missing_serial"` as bare string expressions that do nothing. Compliance issue detection is completely non-functional. | HIGH 7/10 | Architecture |
| 11 | **Jarvis product enrichment route does heavy writes without validation** — validates only `title` and `description`, then proceeds to blindly mutate `inventory`, `products`, and log collections. No output sanitization, no rollback on failure. | HIGH 7/10 | Security |
| 12 | **No database indexes on critical Postgres queries** — Prisma schema has 0 custom indexes beyond auto-generated ones. `AuditLog` queries by `userId`, `action`, `createdAt` will be full table scans at scale. | HIGH 7/10 | Database |
| 13 | **Firestore rules allow staff-level write to PHI collections** — `patients`, `orders`, `rentals`, `insuranceRecords` all allow write from `staff` role. Staff can modify clinical data with no second-person review. | HIGH 7/10 | Compliance |
| 14 | **No input validation on API routes** — `equipment/route.ts` calls service layer without Zod or schema validation. `improvements/route.ts` does manual string checks but no structured validation. | HIGH 7/10 | Security |
| 15 | **`safeUpdateDocument` client-side audit is unreliable** — audit is called after the write completes. If the audit write fails (permission denied, network), the main operation has already succeeded with no record. | HIGH 6/10 | Reliability |
| 16 | **Cloud Function `bootstrapAdminClaim` hardcodes a UID** — a specific Firebase Auth UID can claim admin role by calling this function. If the function is exposed (no App Check enforcement), anyone with that UID gets admin. | HIGH 6/10 | Security |
| 17 | **Password reset admin function allows arbitrary password setting** — `resetUserPassword` in functions accepts `newPassword` as a parameter (min 8 chars) with no complexity requirements. Admin can set weak passwords. | MEDIUM 6/10 | Security |
| 18 | **No helmet/security headers in Next.js config** — missing `X-Content-Type-Options`, `CSP`, `X-Frame-Options`, `Referrer-Policy`. Only `poweredByHeader: false` is set. | MEDIUM 6/10 | Security |
| 19 | **`errors.ts` and `getErrorMessage.ts` are duplicate files** — identical content, same export. This causes confusion and one will desync. | MEDIUM 5/10 | Maintainability |
| 20 | **`globals.css` imported globally but theme system is modular** — likely CSS conflicts between Tailwind v4 and the custom theme tokens. No CSS audit performed but theme-violations.csv exists suggesting known issues. | MEDIUM 5/10 | Frontend |

---

## 3. Top 20 Technical Debt Items Ranked by Impact

| # | Item | Impact | Category |
|---|------|--------|----------|
| 1 | **Zero test coverage across the entire application** — No unit, integration, or E2E tests in `src/` or `functions/src/`. `vitest` is in devDependencies but unused. | 10/10 | Testing |
| 2 | **Dual audit log systems (Postgres + Firestore) with no synchronization** — `src/lib/audit.ts` writes to Postgres via repository, `src/lib/auditLogs.ts` writes to Firestore from client. Same events logged to different stores with no correlation ID. | 9/10 | Architecture |
| 3 | **Firestore direct writes from client code at scale** — `src/lib/inventory.ts`, `src/lib/auditLogs.ts`, `src/lib/firestoreSafeActions.ts` all write directly to Firestore from browser. Bypasses all server-side validation, authZ, and rate limiting. | 9/10 | Architecture |
| 4 | **Duplicate error handling utilities (`errors.ts` vs `getErrorMessage.ts`)** — identical 200+ line files with same exports. A maintainability time bomb. | 8/10 | Maintainability |
| 5 | **`require-user.ts` is a complete auth bypass** — this server component guard returns a hardcoded admin session. Any page or server action using it has zero authentication in production. | 8/10 | Architecture |
| 6 | **No TypeScript `strict` mode violations caught** — `skipLibCheck: true` means third-party type issues are suppressed but so are potential real errors at module boundaries. | 7/10 | Maintainability |
| 7 | **Prisma client is global singleton but adapter is created every time** — `prisma.ts` creates a `new PrismaPg(new Pool(...))` in module scope. Pool is created at import time, not lazily. | 7/10 | Reliability |
| 8 | **`product-enrichment/route.ts` is 600+ lines** — violates the documented architecture guideline that services should be under 300 lines. Contains inline logic for enrichment, auto-fill, image search, and reference matching. | 7/10 | Maintainability |
| 9 | **Firestore schema has no TypeScript validation layer** — `firestore.rules` validates some fields for CPAP pulls/call notes but the vast majority of collections have no field-level validation. | 7/10 | Architecture |
| 10 | **No Firestore security rules for collection group queries to `rows`** — `match /{path=**}/rows/{rowId}` allows any staff/admin read/write to rows under any path, not just importJobs/importedReports. | 7/10 | Security |
| 11 | **`CLAUDE.md` and `.blackboxrules` in project root** — AI/LLM configuration files committed to version control. Not a production risk but indicates development workflow contamination. | 5/10 | DevOps |
| 12 | **`serverExternalPackages: ["firebase-admin"]` in next.config** — forces firebase-admin to be bundled server-side, but `firebaseAdmin.ts` does sync filesystem read which may not work in all serverless environments. | 6/10 | DevOps |
| 13 | **No monitoring or observability setup** — no OpenTelemetry, Sentry, DataDog, or any APM. `console.error` scattered throughout as the sole error recording mechanism. | 6/10 | DevOps |
| 14 | **`adhoc-samples/` directory contains CSV/PDF with real-looking PHI data** — files like `Patients_Demographics.csv`, `Insurance.csv`, `Patient_Physicians.csv` contain sample healthcare data committed to the repo. | 6/10 | Compliance |
| 15 | **Cloud Functions `maxInstances: 10` with no concurrency tuning** — all functions share the same global options. Import processing functions may need different concurrency than lightweight auth functions. | 5/10 | Scalability |
| 16 | **No Firestore backup strategy evident** — `firebase.json` shows no scheduled exports. No disaster recovery documentation. | 5/10 | DevOps |
| 17 | **Migration history shows only 1 migration** — `20260701133541_init_inventory_schema` is the sole migration. Schema has no version history, making rollbacks impossible. | 5/10 | Database |
| 18 | **`appNavigation` in `navigation.ts` is disconnected from `AdminSidebar`** — the sidebar has its own separate `NAV_ITEMS` array. Two sources of truth for navigation. | 4/10 | Maintainability |
| 19 | **`package.json` has no `test` script** — `npm test` will fail. The `verify` script runs lint, typecheck, and build but these will likely fail given the codebase state. | 4/10 | Testing |
| 20 | **`tsconfig.json` has duplicate `exclude` keys** — the `exclude` array appears twice. TypeScript uses the last one, potentially excluding `scripts` and `functions` from type checking. | 3/10 | Maintainability |

---

## 4. Security Score: **18/100**

| Control | Status | Notes |
|---------|--------|-------|
| Authentication | ❌ FAIL | `requireUser()` bypass; JWT verified but soft errors leak info |
| Authorization | ❌ FAIL | No server-side enforcement on client Firestore writes |
| Session Management | ⚠️ WEAK | `browserLocalPersistence` only; no session timeout/rotation |
| Password Recovery | ⚠️ OK | Masks account enumeration but no rate limit on reset calls |
| MFA | ✓ IMPLEMENTED | TOTP flow present in `mfa.ts` but unused in any guard |
| Audit Logging | ❌ FAIL | Dual systems; client-side audit is unreliable; HIPAA non-compliant |
| Secrets Management | ❌ FAIL | `serviceAccountKey.json` loaded from disk at runtime |
| Input Validation | ❌ FAIL | No Zod/schema validation on most API routes; manual checks only |
| Injection Risks | ⚠️ WEAK | Prisma uses parameterized queries (safe); Firestore queries are built from user input |
| XSS | ⚠️ WEAK | React JSX is safe by default, but `dangerouslySetInnerHTML` not audited |
| CSRF | ❌ FAIL | Zero CSRF protection on any API route |
| SSRF | ⚠️ WEAK | Jarvis enrichment fetches external URLs; no allowlist |
| Rate Limiting | ❌ FAIL | None implemented anywhere |
| App Check | ⚠️ WEAK | Initialized but site key may be empty; debug token enabled in dev |

**Key Findings:**

- **CRITICAL:** `requireUser()` in `src/lib/auth/require-user.ts` returns a hardcoded admin session. Every page using it (via `requireRole` or `requirePermission`) has effectively zero authentication.
- **CRITICAL:** No server-side authorization layer exists between browser-initiated Firestore writes and the data. Client code writes directly to `patients`, `orders`, `rentals` collections. The *only* protection is Firestore security rules, which are complex and error-prone.
- **HIGH:** The ChatGPC bridge API key provides unfiltered Firestore access with no PII masking — any ChatGPT user with the API key can query all patient data.

---

## 5. Architecture Score: **35/100**

| Aspect | Score | Notes |
|--------|-------|-------|
| Layer Separation | 5/10 | v2-architecture.md describes good separation but implementation bypasses it |
| Dependency Direction | 4/10 | Services call repositories (good) but client code calls Firestore directly (bad) |
| Service Boundaries | 3/10 | `product-enrichment` route is 600+ lines; services mix database and business logic |
| Code Organization | 5/10 | Well-organized directory structure but many "island" files (e.g., `buildComplianceIssues.ts`) |
| Error Handling | 3/10 | Duplicate error files; catch-all `console.error` + 500 responses |
| State Management | 4/10 | Client components use `useState`/`useEffect`; no global state management for complex flows |

**Key Findings:**

- The application architecture is **dual-layered with a gap**: the documented v2 architecture describes services → repositories → database, but a massive amount of client code directly calls Firestore (`src/lib/inventory.ts`, `src/lib/auditLogs.ts`, `src/lib/firestoreSafeActions.ts`). This means:
  1. Server-side validation is bypassed
  2. Audit logging is unreliable
  3. Authorization checks are partially applied
  4. Business rules in services can be circumvented

- `buildComplianceIssues.ts` contains only three string literals — the entire compliance module is non-functional.

- The Prisma schema has only the `init_inventory_schema` migration with no indexes on `AuditLog`, no foreign key cascades, and no `@updatedAt` on all models (only `Equipment` has it).

---

## 6. Maintainability Score: **28/100**

| Factor | Score | Notes |
|--------|-------|-------|
| Code Duplication | 3/10 | Duplicate error handlers; two audit log systems; duplicate nav configs |
| Test Coverage | 0/10 | Zero tests in entire application |
| Documentation | 5/10 | v2-architecture.md is excellent; but code-level docs are sparse |
| Consistency | 4/10 | Mixed patterns: some routes use services, some use direct Firestore |
| Dependency Management | 6/10 | No circular dependencies found; dependencies are reasonable |
| TypeScript Usage | 4/10 | Many `any` casts; `skipLibCheck: true`; `Record<string, unknown>` patterns |

---

## 7. Scalability Score: **25/100**

| Factor | Score | Notes |
|--------|-------|-------|
| Database Query Efficiency | 3/10 | No custom indexes; N+1 risk in `AuditLog` queries |
| Caching | 0/10 | No Redis, no in-memory cache, no CDN for static assets |
| Serverless Readiness | 4/10 | `firebaseAdmin.ts` does sync filesystem read; blocks event loop |
| Concurrent Request Handling | 3/10 | Inventory allocation functions are not transactional |
| Horizontal Scaling | 5/10 | Next.js + Firebase Functions scale horizontally; but Firestore write contention will be an issue |

**Key Findings:**

- **No indexes on Postgres:** The `AuditLog` model has three columns (`userId`, `action`, `entityType`) that will be queried frequently with no indexes — full table scans at any scale.
- **Inventory allocation race conditions:** `allocateInventoryToOrder` and `restoreInventoryFromOrder` in `src/lib/inventory.ts` are not wrapped in Firestore transactions. Two concurrent requests for the same product will allow both to succeed, resulting in negative inventory.
- **Pool connection leak potential:** The Prisma global singleton creates a `Pool` at module import time with no max connection limit. In serverless (Vercel/Functions), this could exhaust database connections.

---

## 8. Production Readiness Score: **22/100**

| Category | Weight | Score | Weighted |
|----------|--------|-------|----------|
| Security | 30% | 18 | 5.4 |
| Architecture | 20% | 35 | 7.0 |
| Maintainability | 15% | 28 | 4.2 |
| Scalability | 10% | 25 | 2.5 |
| Testing | 15% | 0 | 0.0 |
| DevOps | 10% | 30 | 3.0 |
| **Total** | **100%** | | **22.1** |

---

## 9. Immediate Blockers for Release

These **must** be resolved before production deployment:

1. **`requireUser()` auth bypass** — The hardcoded admin session in `src/lib/auth/require-user.ts` means any protected page or server action is accessible without authentication. **Fix:** Wire real Firebase Auth token verification. **Blocking: YES**

2. **CSRF protection missing** — All POST/PATCH/DELETE API routes accept requests from any origin. Without SameSite cookies or CSRF tokens, an attacker can trivially forge authenticated requests. **Blocking: YES**

3. **No rate limiting** — Login, password reset, and all API endpoints are unprotected against brute-force and DoS attacks. **Blocking: YES**

4. **`serviceAccountKey.json` loading from disk** — `firebaseAdmin.ts` will throw `ENOENT` in environments where this file is not present (CI/CD, fresh deployments, containers). **Blocking: YES**

5. **Zero test coverage** — No tests means every deploy is a blind gamble. Cannot certify production readiness without at minimum smoke tests for critical paths. **Blocking: YES**

6. **Client-side Firestore writes to PHI collections** — The current architecture allows browser-originated writes to `patients`, `orders`, `rentals` etc. **Fix:** Move all PHI writes to server API endpoints with proper authZ. **Blocking: YES**

7. **Audit logging is non-compliant** — Client-side audit fires after the fact with no guarantee of delivery. HIPAA requires definitive, non-repudiable audit trails. **Blocking: YES**

---

## 10. Recommended Roadmap

### Before Release (Week 1-3)

**Week 1 — Critical Security Fixes:**
- [ ] Replace `requireUser()` with real Firebase ID token verification
- [ ] Add CSRF protection middleware to all API routes (origin/referrer check + double-submit cookie or SameSite=Strict)
- [ ] Implement rate limiting on auth endpoints (login, password reset) — use `express-rate-limit` wrapper or Vercel WAF
- [ ] Remove `serviceAccountKey.json` filesystem loading; use environment variable `FIREBASE_SERVICE_ACCOUNT_JSON` instead
- [ ] Add input validation (Zod) to all API routes — start with equipment, improvements, jarvis endpoints

**Week 2 — Audit & Compliance:**
- [ ] Move all PHI-modifying operations to server-side API routes only; remove client-side Firestore writes to `patients`, `orders`, `rentals`, `insuranceRecords`
- [ ] Unify audit logging to single system (Postgres is the better choice for relational queries)
- [ ] Add mandatory audit logging to every PHI mutation — audited operations must be atomic with the data mutation
- [ ] Implement Firestore rules review: remove `staff` write access to PHI collections; require `admin` or specific documented roles

**Week 3 — Reliability & Database:**
- [ ] Add Prisma indexes on `AuditLog.userId`, `AuditLog.action`, `AuditLog.createdAt`, `Equipment.assetTag`, `WorkOrder.equipmentId`
- [ ] Wrap inventory allocation functions in Firestore transactions
- [ ] Add proper error boundaries and retry logic for Firestore operations
- [ ] Remove duplicate `errors.ts` / `getErrorMessage.ts` files, consolidate into one

### First Month After Release

- [ ] **Monitoring:** Add Sentry or OpenTelemetry for error tracking and performance monitoring
- [ ] **Testing Sprint:** Write integration tests for all API routes, service layer, and critical business logic
- [ ] **ChatGPT Bridge:** Add PII masking, query logging, and rate limiting to the bridge
- [ ] **Firestore Backup:** Set up automated daily Firestore exports to Cloud Storage
- [ ] **Security Headers:** Add CSP, HSTS, X-Frame-Options, Referrer-Policy via Next.js middleware
- [ ] **Session Management:** Add idle timeout and re-authentication for sensitive operations
- [ ] **Firestore Rules Audit:** Test rules with `@firebase/rules-unit-testing` (devDependency exists but unused)

### Long-Term Improvements (3-6 Months)

- [ ] **Move to unified backend:** Consider consolidating all data operations behind a single API gateway (Next.js API routes or a dedicated backend) rather than dual client/server paths
- [ ] **CI/CD pipeline:** Add automated testing, security scanning (npm audit, Snyk), and deployment gating
- [ ] **Disaster recovery:** Document and test restore procedures for both Firestore and PostgreSQL
- [ ] **Performance:** Add Redis caching layer for frequently-accessed reference data (products, HCPCS codes)
- [ ] **Authorization model:** Implement attribute-based access control (ABAC) for granular data-level permissions
- [ ] **Database migration strategy:** Establish proper Prisma migration workflow with manual review gates
- [ ] **API versioning:** Add versioning scheme for public/partner APIs (ChatGPT bridge, potential 3rd party integrations)
- [ ] **Accessibility audit:** Run axe-core or similar against all admin pages; address WCAG 2.1 AA violations
- [ ] **Remove AI development artifacts:** `.blackboxrules`, `CLAUDE.md`, `prompts/prompt.txt` should not be in production repo
- [ ] **Clean up sample PHI data:** Remove `adhoc-samples/` directory with apparent patient data from repository

---

## Detailed Findings by Category

### Authentication (Scored: 15/100)

The most critical finding is `src/lib/auth/require-user.ts` (line 17-24):

```typescript
export async function requireUser(): Promise<UserSession> {
  return {
    id: "dev-user",
    name: "Development User",
    email: "dev@advancedhomemedical.local",
    role: "admin",
    isActive: true,
  };
}
```

This function has a comment "Temporary guard until full auth is wired in" but it is the implementation used by `requireRole()` and `requirePermission()` which are called by server components like the admin layout. Any page using these guards has zero authentication.

Meanwhile, `require-api-auth.ts` has a correctly implemented Firebase ID token verification — but this is only used by API routes. The server component path is completely unprotected.

### Authorization (Scored: 20/100)

The authorization model is fragmented:
1. **API routes** use `requireApiPermission()` which checks the permission map — this is well-designed
2. **Server components** use `requireUser()` which is a no-op (see above)
3. **Firestore direct writes** rely solely on Firestore security rules
4. **Cloud Functions** have their own `assertAdmin()` helper

The Firestore rules file (`firestore.rules`) is 300+ lines and attempts to implement role-based access, but:
- The `role()` function has three fallback sources (custom claims → Firestore profile)
- Staff can write to patients, orders, rentals, insurance records
- The collection group rule `match /{path=**}/rows/{rowId}` allows write to rows under ANY path, not just within importJobs

### Data Integrity (Scored: 30/100)

**PostgreSQL:**
- Prisma schema has no `@unique` on most fields that should be unique (e.g., `Equipment.serialNumber` is unique but there's no validation at the application layer)
- No cascade deletes — deleting a `Manufacturer` will fail if models exist
- `AuditLog` table has no foreign keys — `userId` is a loose string reference that can point to a non-existent user

**Firestore:**
- Inventory allocation functions (`allocateInventoryToOrder`, `allocateInventoryToRental`) are not wrapped in Firestore transactions
- A race condition: two concurrent allocations for the same product will both pass the `quantityOnHand >= qty` check and decrement below zero
- Stock movements are logged as separate documents; consistency between product quantity and movement log is not guaranteed

### Error Handling (Scored: 25/100)

- **Duplicate files:** `src/lib/errors.ts` and `src/lib/getErrorMessage.ts` are byte-for-byte identical
- **`catch` blocks are empty or just log:** `require-api-auth.ts` line 56-60 catches token verification error with empty block
- **No structured error responses:** API routes return `{ error: string }` but there's no error code, no correlation ID, no stack trace in dev
- **500s on every unexpected error:** Most routes have `catch { return NextResponse.json({ error: "..." }, { status: 500 }) }` — no error differentiation

### Testing (Scored: 0/100)

- Zero unit, integration, or E2E tests found in `src/` or `functions/src/`
- `vitest` is in `devDependencies` (version ^4.1.4) but there are no test files
- `package.json` has no `test` script
- The `verify` script runs `lint && typecheck && build` — all three are likely to fail given the codebase state
- No test configuration file found (`vitest.config.ts` does not exist in project root)

### DevOps (Scored: 30/100)

- **No `.env.example`** — developers must guess environment variables
- **`serviceAccountKey.json` loaded from disk** — will fail in serverless/GitHub Actions
- **No Docker configuration** for local PostgreSQL development
- **Firebase functions have manual deploy** — no CI/CD pipeline visible
- **No monitoring/alerting** — console.log is the sole observability mechanism
- **No backup strategy documented** for either Firestore or PostgreSQL

### Frontend (Scored: 35/100)

- **Accessibility:** `AuthGuard.tsx` and `AdminSidebar.tsx` have reasonable ARIA attributes but keyboard navigation and focus management were not thoroughly tested
- **Large components:** `LoginClient.tsx` is 280+ lines combining form state, MFA challenge, error handling, and routing — should be split
- **State management:** No global state library (Redux, Zustand, Jotai). Auth state is managed via `useState` + `useEffect` with a module-level `roleCache` variable — this is fragile and can leak across components
- **Performance:** No `React.memo()`, `useMemo()` is used in some places but not consistently. The sidebar re-renders every navigation

### Firestore Security Rules (Scored: 40/100)

The rules are comprehensive but have several issues:

1. **Staff can write to PHI collections** — `patients`, `orders`, `rentals`, `insuranceRecords` all allow `if isStaffOrAdmin()` for write. This means a technician can modify clinical documentation without oversight.

2. **Collection group rule for `rows` is too permissive** — `match /{path=**}/rows/{rowId}` allows read/write on any `rows` subcollection under any document. This should be scoped to only `importJobs/{jobId}/rows/{rowId}` and `importedReports/{reportId}/rows/{rowId}`.

3. **`insurancePatients` write is admin-only but read is staff** — this is reasonable, but `patientAuthorizations` is also admin-only write with staff read. These should be consistent with related collections.

4. **`deliveryTechLocations` read is admin-only** — this seems like an oversight; delivery technicians need to read their locations.

5. **No rate limiting in rules** — Firestore rules cannot rate-limit, but there's no application-layer protection against bulk reads.

---

*End of Audit Report*
