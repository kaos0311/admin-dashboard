# Auth & User Management Implementation Plan

**Project:** Advanced Home Medical Admin Dashboard  
**Date:** Based on `AUTH_USER_MANAGEMENT_AUDIT.md`  
**Status:** Plan only — no code changes made.

---

## Overview

This plan breaks the remediation of the authentication/authorization/user-management architecture into **11 independently reviewable stages**. Each stage is self-contained, reviewable, and reversible. Stages should be merged in order; each stage must pass validation before the next begins.

**Guiding principles:**

- Firestore `users/{uid}` is the **single authoritative source** for role and status.
- Custom claims are a **server-authorized hint only** — never the basis for authorization alone.
- Every privileged callable goes through **one** central server authorization helper.
- Missing Firestore user document **fails closed** (deny).
- Disable/delete semantics are explicit and audited.
- Functions operate without module-load-time side effects.

---

## Stage 1 — Canonical user and role types

**Goal:** Define the single set of TypeScript types and constants for roles and user status shared by both the client and Functions.

**Files affected:**

- `functions/src/auth/roles.ts` — add exports: `DASHBOARD_ROLES`, `DASHBOARD_USER_STATUSES`, `DashboardRole`, `DashboardUserStatus`, `isAdminRole` (already exists, keep behavior).
- `functions/src/adminUsers.ts` — remove local `type DashboardRole`; import shared types.
- `functions/src/adminUserManagement.ts` — remove local `type Role`; import shared types.
- `src/lib/permissions/roles.ts` — import/duplicate the canonical constants; keep `UserRole` alias; add `isDeletedRole`-independent status handling.
- New `src/lib/userTypes.ts` or extend `src/lib/permissions/roles.ts` for the client mirror.

**Architectural change:** Introduce a single canonical role set (`admin`, `staff`, `tank`) and a future status enum (`active`, `disabled`, `deleted`). No behavior change in this stage — types compile to the same runtime values.

**Risks:**

- Client/server type drift if one side is updated without the other (add a shared `types` export in the client and make Functions import from a local shared file, not cross-package since `functions` is a separate package).
- Ensure no import cycle with `src/lib/permissions/roles.ts`.

**Validation commands:**

```bash
cd functions && npm run build
cd .. && npm run lint && npm run typecheck
```

**Rollback:** Revert stage commit; no runtime behavior changed.

**Dependencies:** None.

---

## Stage 2 — Central server authorization helper

**Goal:** One `requireCallableAdmin` (and optionally `requireCallableStaffOrAdmin`) used by every privileged callable. Move the existing `requireCallableAdmin` from `functions/src/auth/roles.ts` into a more prominent home (keep it there; just extend it) and make it:

1. Throw `unauthenticated` when `request.auth` is missing.
2. Read `users/{actorUid}` from Firestore.
3. **Deny when the document is missing** (fail-closed).
4. Deny when `status`-derived state is `disabled`/`deleted` (accept legacy `disabled:true`/`deleted:true`/`active:false`).
5. Allow only `admin`/`tank`.
6. Return the actor uid.

**Files affected:**

- `functions/src/auth/roles.ts` — fail-closed doc-missing behavior (behind a flag initially if existing admins lack docs; see Risks).
- `functions/src/adminUsers.ts` — replace local `requireAdmin` with central helper.
- `functions/src/adminUserManagement.ts` — replace local `assertAdmin` with central helper.
- `functions/src/resetOperationalDatabase.ts`, `functions/src/maintenance/*.ts` — already use the central helper; just re-verify after `roles.ts` change.

**Architectural change:** Single enforcement point. This is the security-critical change.

**Risks:**

- **Existing admins with missing docs will lose access** (fail-closed). Mitigate with a pre-migration audit (query `users` docs vs `auth` users) and a temporary allowlist flag `AUTH_ALLOW_TOKEN_FALLBACK=true` documented for removal.
- Behavioral change must be coordinated with client `AuthGuard` (Stage 10) to avoid one-sided lockout.

**Validation commands:**

```bash
cd functions && npm run build
cd .. && npm run lint && npm run typecheck
```

Add unit tests in `functions/src/auth/roles.test.ts` for: missing auth, missing doc, disabled doc, deleted doc, staff role, admin role, tank role.

**Rollback:** Revert commit; previous behavior (token fallback) resumes.

**Dependencies:** Stage 1.

---

## Stage 3 — Normalize Firebase callable error contracts

**Goal:** Consistent HttpsError codes + messages across all auth/user-management callables.

**Files affected:**

- `functions/src/error.ts` (new) — shared helpers: `assertAuthenticated`, `mapAdminSdkError`, `ok()`.
- `functions/src/adminUsers.ts` — use shared error helpers; ensure `unauthenticated` (not `permission-denied`) for missing auth.
- `functions/src/adminUserManagement.ts` — add full error mapping for Admin SDK errors (`auth/user-not-found`, `auth/email-already-exists`, `auth/invalid-email`, `auth/insufficient-permission`).
- `src/lib/adminUsers.ts` — document expected `code` values; switch client matching to `code`, never HTTP status.

**Architectural change:** Stable machine-readable error codes.

**Risks:**

- Client code that matches on HTTP status or message text will break → coordinate with Stage 10.

**Validation commands:**

```bash
cd functions && npm run build
cd .. && npm run lint && npm run typecheck && npm test
```

**Rollback:** Revert commit; messages revert.

**Dependencies:** Stage 2.

---

## Stage 4 — Repair user creation workflow

**Goal:** `createDashboardUser` uses the central helper, fails closed, and cannot create an orphaned user.

**Files affected:**

- `functions/src/adminUsers.ts` — remove local `requireAdmin + mapAuthError`; use central helper + shared error map.
- Add **transactional cleanup**: if Firestore doc write fails after `createUser`, delete the Auth user (best-effort) and return `internal` with a precise message.
- Ensure `validatePayload` rejects unknown roles (fail-closed) instead of defaulting to `staff`.

**Architectural change:** No orphan users (Auth exists without doc) on the happy path; deterministic errors.

**Risks:**

- Cleanup adds a second Admin API call; must not cause infinite retries (catch and log).
- Rejecting unknown roles changes behavior for clients sending garbage — intentional.

**Validation commands:**

```bash
cd functions && npm run build
cd .. && npm run lint && npm run typecheck
```

Add/extend tests for duplicate email, invalid payload, insufficient permission mapping.

**Rollback:** Revert commit.

**Dependencies:** Stages 2, 3.

---

## Stage 5 — Repair role update workflow

**Goal:** `updateUserRole` cannot silently re-enable a disabled user; role changes propagate to doc + claims atomically-ish.

**Files affected:**

- `functions/src/adminUserManagement.ts` — stop writing `disabled:false` unconditionally on role change; only clear `disabled` if the actor explicitly requests re-enable (new optional payload field `reEnable?: true`).
- Prevent demoting the last active admin to `staff` (safety check).
- Keep audit entry; write `updatedBy`.

**Architectural change:** Role update no longer implies status change.

**Risks:**

- UI must be updated (Stage 10) to offer explicit re-enable; until then, roles of disabled users just change without re-enabling (safe default).
- Last-admin-demotion guard adds a new query (count of active admins).

**Validation commands:**

```bash
cd functions && npm run build
cd .. && npm run lint && npm run typecheck
```

**Rollback:** Revert commit.

**Dependencies:** Stages 2, 3.

---

## Stage 6 — Repair password reset workflow

**Goal:** `resetUserPassword` is the explicit administrative reset with correct errors and no enumeration.

**Files affected:**

- `functions/src/adminUserManagement.ts` — map `auth/user-not-found` → `not-found`; add `auth/invalid-password`, `auth/insufficient-permission` mapping.
- Keep length ≥ 8, don't log the password, keep `passwordResetAt`/`passwordResetBy` + audit.
- Add explicit success contract to client `src/lib/adminUsers.ts`.

**Architectural change:** Deterministic errors; documented reset semantics.

**Risks:**

- No requirement change — pure error-contract hardening, low risk.

**Validation commands:**

```bash
cd functions && npm run build
cd .. && npm run lint && npm run typecheck
```

**Rollback:** Revert commit.

**Dependencies:** Stage 3.

---

## Stage 7 — Canonical disable/delete lifecycle

**Goal:** Consistent, explicit disable/delete semantics with no orphan states, using a single `status` field while back-compat reading legacy booleans.

**Files affected:**

- `functions/src/adminUserManagement.ts`:
  - `disableDashboardUser` → Auth `disabled:true` + doc `status:"disabled"`, `disabled:true`, `disabledAt`.
  - `enableDashboardUser` → Auth `disabled:false` + doc `status:"active"`, `disabled:false`.
  - `deleteUserAccount` → Auth `deleteUser` + doc `status:"deleted"`, `deleted:true`, `deletedAt`, `deletedBy` (already present); **never hard-delete the doc**.
- `functions/src/auth/roles.ts` — read `status` with legacy fallback.
- `src/lib/permissions/roles.ts` + `AuthGuard.tsx` — handle `status`:
  - `status:"active"` → allowed;
  - `status:"disabled"` → signed out / "inactive";
  - `status:"deleted"` → signed out / "account removed".
- New Firestore rule (later): deny client writes to `users/{uid}.status`, `role`.

**Architectural change:** One status field; legacy booleans still recognized during migration.

**Risks:**

- Requires data backfill for existing docs (see Stage 9).
- Client must understand both `status` and legacy booleans during transition.

**Validation commands:**

```bash
cd functions && npm run build
cd .. && npm run lint && npm run typecheck
```

Extend tests for disable/enable/delete transitions and legacy-doc compatibility.

**Rollback:** Revert commit; legacy booleans still honored.

**Dependencies:** Stages 1, 2, 5.

---

## Stage 8 — Custom claim synchronization

**Goal:** Claims are created/updated only by the central privileged flows; disabled/deleted users can never be authorized by stale claims.

**Files affected:**

- `functions/src/adminUserManagement.ts`:
  - `disableDashboardUser` — optionally clear claims (`{ role: null }`) after doc write; not strictly needed (Auth `disabled` blocks new tokens) but removes stale-claim surface.
  - `deleteUserAccount` — claims are moot (Auth deleted); ensure no resurrect path.
- `functions/src/auth/roles.ts` — document: claims are hints; never authorize from claims alone (already the case).
- `functions/src/bootstrapAdmin.ts` — replaced/de-commissioned in Stage 9 (this stage updates its behavior if it still exists).

**Architectural change:** Documented claim lifecycle; explicit invalidation.

**Risks:**

- `setCustomUserClaims` triggers token refresh client-side; brief flicker while `getIdTokenResult(true)` re-validates — acceptable.

**Validation commands:**

```bash
cd functions && npm run build
cd .. && npm run lint && npm run typecheck
```

**Rollback:** Revert commit; disabling still effective via doc + Auth flags.

**Dependencies:** Stages 2, 7.

---

## Stage 9 — Functions bootstrap isolation

**Goal:** No module-load-time side effects; a failing module cannot take down the whole Functions deployment.

**Files affected:**

- `functions/src/adminUsers.ts` — move `getFirestore()`/`getAuth()` calls inside handlers.
- `functions/src/adminUserManagement.ts` — same.
- `functions/src/resetOperationalDatabase.ts` — same.
- `functions/src/index.ts` — optionally split maintenance/rebuild exports into `index-maintenance.ts`; keep the main entrypoint to core business triggers.
- Review storage-trigger modules for module-scope `getStorage()`/`getFirestore()`.

**Architectural change:** Lazy initialization; smaller blast radius.

**Risks:**

- Refactor touches many files; must re-run all Functions tests.
- Deploy surface changes if entrypoints split — update `firebase.json`/CI.

**Validation commands:**

```bash
cd functions && npm run build
cd functions && npm test
cd .. && npm run lint && npm run typecheck
```

Also run a local `firebase emulators:exec` with `FIRESTORE_EMULATOR_HOST` unset to prove no load-time failure (if emulator available locally; otherwise document manual step).

**Rollback:** Revert commit; module-scope init returns.

**Dependencies:** None (can be done early if desired; placed here to sequence with the authz refactor that touches the same files).

---

## Stage 10 — Client UI cleanup

**Goal:** Client guards and user-management UI match new server contracts.

**Files affected:**

- `src/app/components/auth/AuthGuard.tsx` — deny when doc missing (reflect Server fail-closed); handle `status` field; keep `getIdTokenResult(true)` refresh.
- `src/app/hooks/useAuthRole.ts` — use canonical types; handle `status`.
- `src/lib/adminUsers.ts` — match on error `code`; surface `not-found`, `already-exists`, `resource-exhausted` consistently.
- User-management page/component (search for the page using `createDashboardUser`/`updateUserRole` etc.) — add explicit "re-enable" checkbox for role changes; confirm dialog for delete/reset.
- `src/lib/firebase/client.ts` — move Firebase config to env vars (`NEXT_PUBLIC_FIREBASE_*`) with fallback to current hardcoded values (do not commit secrets; these are public web keys).

**Architectural change:** Client and server agree on one model.

**Risks:**

- Users with missing docs get signed out — coordinated with Stage 2 (deploy server first, then client; or feature-flag).
- Environment migration touches `.env.local`; do not commit.

**Validation commands:**

```bash
npm run lint && npm run typecheck && npm run build && npm test
```

**Rollback:** Revert commits.

**Dependencies:** Stages 1–8.

---

## Stage 11 — Authorization and lifecycle tests

**Goal:** Automated coverage of the full authz matrix and user lifecycle.

**Files affected (new tests):**

- `functions/src/auth/roles.test.ts` — unit tests for the central helper using mocked Firestore.
- `functions/src/adminUsers.test.ts` — create-user flow, duplicate email, orphan cleanup.
- `functions/src/adminUserManagement.test.ts` — disable/enable/delete/role/password flows with error mapping.
- `src/lib/permissions/roles.test.ts` — extend for status handling.
- Optional integration test script (manual): `scripts/verify-authz.mjs` against a **staging/emulator** project only.

**Test matrix (from task):**

| Case | Expect |
|---|---|
| Unauthenticated admin action | `unauthenticated` |
| Staff attempts admin action | `permission-denied` |
| Tank attempts admin action | **Allowed** (documented) |
| Admin performs valid action | `success` |
| Disabled admin attempts action | `permission-denied` |
| Deleted admin attempts action | `permission-denied` |
| Admin role removed while token stale | Denied via doc (stale claim ignored) |
| Create duplicate email | `already-exists` |
| Create valid user | doc + claims + audit |
| Role update | doc + claims + audit |
| Disable user | Auth disabled + doc disabled |
| Re-enable user | Auth enabled + doc active |
| Password reset | `passwordResetAt` set + audit; password never logged |
| Delete user | Auth removed + doc soft-deleted + audit |
| Missing Firestore user doc | **Deny** (fail-closed) |
| Auth exists without profile | Deny |
| Profile exists without Auth | Deny/log orphan audit; UI shows missing account |
| Functions init with incomplete local env | Load succeeds; callable fails only when invoked with clear error |

**Validation commands:**

```bash
cd functions && npm run build && npm test
cd .. && npm run lint && npm run typecheck && npm test
```

**Rollback:** Tests are additive; revert if flaky.

**Dependencies:** All prior stages.

---

## Suggested Merge Order & Release Cadence

| Stage | Risk | Suggested Review |
|---|---|---|
| 1 | Low | 1 reviewer, types-only |
| 2 | **Critical** | 2 reviewers + security review; run against staging |
| 3 | Medium | 1 reviewer; client contract doc update |
| 4 | Medium | 1 reviewer; test duplicate-email |
| 5 | Medium | 1 reviewer; confirm UI has re-enable flow |
| 6 | Low | 1 reviewer; error map only |
| 7 | **High** | 2 reviewers; data-backfill script reviewed |
| 8 | Medium | 1 reviewer; claim tests |
| 9 | Medium | 2 reviewers; deploy scripts |
| 10 | Medium | 2 reviewers; manual regression on auth flows |
| 11 | Low | 1 reviewer; CI integration |

**Note on ordering:** If the 403 issue is urgent, Stage 2 + Stage 3 can ship together as a single high-priority PR **before** Stage 1 if the shared types are folded into `roles.ts` — but Stage 1 is cheap and reduces drift, so do it first.

---

## Rollback Strategy (general)

- Every stage is a single coherent commit (or small PR) with no hidden dependencies.
- Reverting a stage restores the exact previous behavior; no data migrations run automatically.
- **Exception:** if Stage 7's backfill script is run against production, keep a snapshot of `users` collection in a `backup_*` collection and document the revert script.

---

## Out of Scope (this plan)

- Firebase Security Rules (`firestore.rules`) — to be audited and updated in a separate task, but Stage 7 introduces the `status` field they must eventually reference.
- Firestore data backfill script for existing `users` docs — authored in Stage 7 as a reviewed migration artifact; **never run automatically**.
- Removing `bootstrapAdminClaim` — staged in Stage 9 alongside bootstrap isolation; replace with a console-driven flow documented in the plan.
- Any change to Firebase project, region, or auth providers.

---

## Validation Checklist (acceptance)

- [ ] `functions` build passes.
- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` pass.
- [ ] No module-load-time Firebase side effects remain (grep for module-scope `getFirestore/getAuth/getStorage`).
- [ ] Grep confirms only one `isAdminRole` implementation on the server.
- [ ] `requireCallableAdmin` is the only authz gate for user-management callables.
- [ ] Client matches errors by `code`, not HTTP status.
- [ ] No new hardcoded roles/status strings outside the canonical file.
- [ ] Audit log entries exist for create/update/disable/enable/delete/reset.