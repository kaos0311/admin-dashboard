# Authentication, Authorization & User Management Audit

**Project:** Advanced Home Medical Admin Dashboard  
**Date:** Audit performed from repository inspection  
**Scope:** Firebase Authentication, Admin SDK, Firestore user documents, callable Cloud Functions, client auth state, session handling, admin authorization, user lifecycle operations  
**Status:** Inspection-only. No code, security rules, user records, or deployments were modified.

---

## 1. Executive Summary

The dashboard uses **Firebase Authentication (email/password)** as the identity provider and **Firestore `users/{uid}`** as the application profile store. Roles (`admin`, `staff`, `tank`) are stored in **two places**: Firebase custom claims (`token.role`) and the Firestore user document (`users/{uid}.role`). Server-side authorization helpers generally treat the **Firestore document as authoritative when present** and fall back to the token claim when the document is missing. The client-side `AuthGuard` performs the same resolution for UI gating.

The most important findings:

- **Three separate, near-duplicate admin authorization implementations** exist in Functions (`functions/src/auth/roles.ts`, `functions/src/adminUsers.ts`, `functions/src/adminUserManagement.ts`). They are not identical, so behavior can differ by operation.
- **`tank` is treated as an admin role** in every authorization check inspected. This is intentional but undocumented and means staff cannot create/update/delete users.
- **Custom claims are only ever assigned, never revoked.** `disableDashboardUser` disables the Auth account and sets `disabled: true` in Firestore, which blocks new token issuance and is checked by server helpers — but `updateUserRole` and `deleteUserAccount` do not clear claims, so stale claims can persist.
- **`deleteUserAccount` deletes the Auth account but only soft-marks the Firestore doc `deleted: true`.** The doc remains and will permanently block that uid from ever being re-created for the same uid (Firestore doc cannot be recreated with the same data pattern). This preserves audit records but creates an orphan-state trap.
- **`bootstrapAdminClaim` grants admin via a hardcoded UID** with no Firestore verification. Anyone who authenticates as that UID can re-grant themselves admin claims even if Firestore says otherwise.
- **Functions bootstrap is fragile**: several modules call `getFirestore()` / `getAuth()` at module load time and the entrypoint re-exports every module. One module-level failure takes down the entire Functions deployment.
- **Password reset is a direct administrative password overwrite** via Admin SDK — not a Firebase password-reset email. This matches an administrative workflow but must be accompanied by user education and audit logging (which exists).
- **The most likely cause of the reported HTTP 403 user-management failures** is the `assertAdmin`/`requireAdmin` check rejecting an authenticated admin because their Firestore `users/{uid}` document is **missing, lacks a `role` field, or has `disabled`/`deleted`/`active:false`** — while their token claim is also absent or non-admin (e.g., admin created in Firebase console without claims, or claims cleared). The callable verifies the caller, then the application-level check rejects the operation with `permission-denied`, which surfaces to the client as HTTP 403.

---

## 2. Authentication Architecture

### Identity Provider

- **Firebase Authentication, email/password**, project `advanced-home-medical-55772`, region `us-central1`.
- Client SDK: `src/lib/firebase/client.ts` — `initializeApp`, `getAuth`, `initializeFirestore` (persistent local cache, multi-tab), `getFunctions(app, "us-central1")`.
- Server/Admin SDK: `firebase-admin` used throughout Functions; initialized via `getApps().length ? getApps()[0] : initializeApp()` in `functions/src/adminUsers.ts` and `functions/src/adminUserManagement.ts`; other modules (e.g., `resetOperationalDatabase.ts`, `auth/roles.ts`) rely on implicit initialization.

### Client Authentication State

- `src/app/components/auth/AuthGuard.tsx` is the gatekeeper component:
  1. `onAuthStateChanged(auth, ...)`
  2. Signed-out → `clearSessionCookie()` → redirect to `/login?next=...`
  3. Signed-in → `user.getIdTokenResult(true)` (force refresh) to read `token.role`
  4. Reads Firestore `users/{uid}`; if missing, falls back to token role
  5. If Firestore record is inactive (`active === false`, `disabled === true`, `deleted === true`) → `auth.signOut()` + `clearSessionCookie()` + redirect to `/login`
  6. If role not allowed → "Access blocked" screen
  7. On success → syncs server session cookie via `createSessionCookie(idToken)`
- `src/app/hooks/useAuthRole.ts` and `src/lib/permissions/roles.ts` provide client-side role resolution helpers: `getRoleFromUserRecord`, `isActiveUserRecord`, `isAdminRole`, `parseRole`, `resolveUserRole`.

### Server Session

- `src/app/api/auth/session/route.ts` implements the session-cookie exchange (verify ID token with Admin SDK → set httpOnly cookie). Client helper `src/lib/auth/session-client.ts` (`createSessionCookie`, `clearSessionCookie`) and server helpers `src/lib/auth/session.ts` / `session-csrf.ts` exist with tests.
- **No Next.js `middleware.ts` was found at the repository root or in `src/`** during inspection; route protection relies primarily on the client-side `AuthGuard`, which means server-rendered routes without the guard could be reached if a URL is hit directly. The session cookie exists but its enforcement surface was not fully verified (the session route file inspection returned corrupted output and was not re-read; this is a gap to verify in Stage 1).

### Flow

```
User Login (Firebase Auth email/password)
  → ID Token (client SDK)
  → onAuthStateChanged (client)
  → AuthGuard: getIdTokenResult(true) → token.role
  → AuthGuard: Firestore users/{uid} → doc.role, active/disabled/deleted
  → AuthGuard: resolveUserRole(tokenRole, dbRole)
  → Client UI authorized
  → Server session cookie created (createSessionCookie)
  → Callable Functions: token verified by Firebase platform
  → Server authz helper: Firestore users/{actor uid} → role/status
  → Operation executed
```

---

## 3. Authorization Architecture

### Where Authorization Is Enforced

| Layer | Enforcement |
|---|---|
| Firebase platform | Verifies the ID token for callable/`onRequest` functions (`request.auth`). This is **authentication only**. |
| Firestore security rules | **Not inspected in this audit** (`firestore.rules` was not confirmed present in the walk). If absent, Firestore is open to the app/service-account path. **Verify as HIGH priority.** |
| Callable Functions | `requireCallableAdmin` (`functions/src/auth/roles.ts`) used by `resetOperationalDatabase`, maintenance functions. Local `requireAdmin`/`assertAdmin` in `adminUsers.ts` / `adminUserManagement.ts`. Other callables may check only `request.auth` presence. |
| OnRequest Functions | `trackQrScan` has **no auth check at all** (public QR tracking). |
| Client UI | `AuthGuard` + `useAuthRole` — visibility only, never security. |

### Authoritative Layer

- **Identity:** Firebase Authentication — authoritative.
- **Role:** Both token claims and Firestore doc; the server helpers treat the **Firestore doc as authoritative when present**, token claim is fallback when doc missing. This is duplicated state and can drift.
- **Active/disabled/deleted:** Only in the Firestore doc (`active`, `disabled`, `deleted`). The **Auth account `disabled` flag is also set** by `disableDashboardUser`/`enableDashboardUser`, giving Firebase Auth a second source for disabled state.
- **Admin permissions:** Server helpers — but only the three Functions modules mentioned. No shared helper is used for user-management callables.

---

## 4. User Data Model

### Firestore `users/{uid}` fields written by the codebase

| Field | Written By | Notes |
|---|---|---|
| `uid` | `createDashboardUser`, `bootstrapAdminClaim` | Redundant with doc id |
| `email` | `createDashboardUser` | Lowercased, trimmed |
| `displayName` | `createDashboardUser` | Optional |
| `role` | `createDashboardUser`, `updateUserRole`, `bootstrapAdminClaim` | `admin` \| `staff` \| `tank` |
| `active` | `bootstrapAdminClaim` (`true`) | Not written by user-management flows |
| `disabled` | `createDashboardUser` (`false`), `updateUserRole` (`false`), `disableDashboardUser` (`true`), `enableDashboardUser` (`false`), `deleteUserAccount` (`true`), `bootstrapAdminClaim` (`false`) | Dual state with Auth `disabled` |
| `deleted` | `deleteUserAccount` (`true`) | Soft delete marker |
| `createdAt` | `createDashboardUser` | ServerTimestamp |
| `updatedAt` | All user ops | ServerTimestamp |
| `createdBy` | `createDashboardUser` | Actor uid |
| `updatedBy` | `updateUserRole`, disable/enable/delete, password reset | Actor uid |
| `deletedAt` / `deletedBy` | `deleteUserAccount` | ServerTimestamp / actor uid |
| `passwordResetAt` / `passwordResetBy` | `resetUserPassword` | ServerTimestamp / actor uid |
| `token.role` (custom claim) | `createDashboardUser`, `updateUserRole`, `bootstrapAdminClaim` | Not revoked on disable/delete |

### Findings

- **Duplicated:** `role` (claims + doc), `disabled` (Auth account flag + doc), `uid` (doc id + field), `email` (Auth + doc).
- **Missing:** `emailVerified` is not written to the doc (Auth has it); no `lastLoginAt`; no explicit `status` enum; `active` is written only by the bootstrap, so most docs never set it — checks use `active === false` (treating undefined as active, which is safe).
- **Inconsistent naming:** `disabled`/`deleted`/`active` boolean trio is fragile and has no single derived `status` field.
- **Stale-state risks:** `deleteUserAccount` leaves the doc with `deleted: true, disabled: true` permanently; the same uid can never be reused.
- **Client-controlled fields:** The client only **reads** these docs; no client path writes `role`/`disabled`/`deleted`. Server-controlled, good. (But `bootstrapAdminClaim` is a server path that writes `active: true` and admin role without verifying the Firestore doc.)

---

## 5. Role Model

### Roles

| Role | Meaning | Admin-equivalent (per code) |
|---|---|---|
| `admin` | Full access | Yes |
| `staff` | Normal operator | No |
| `tank` | (Undocumented) | **Yes — treated as admin everywhere** |

### Where Roles Are Defined / Compared

- Canonical definition: `functions/src/adminUsers.ts` (`type DashboardRole`), `functions/src/adminUserManagement.ts` (`type Role`), `functions/src/auth/roles.ts` (`isAdminRole`), `src/lib/permissions/roles.ts` (`UserRole`).
- `isAdminRole` = `value === "admin" || value === "tank"` in all three server files and client `roles.ts`.
- Assigned in: `createDashboardUser`, `updateUserRole`, `bootstrapAdminClaim` (claim `role`, doc `role`).
- Validated in: `adminUsers.requireAdmin`, `adminUserManagement.assertAdmin`, `auth/roles.requireCallableAdmin`.
- Persisted: doc + claims.
- Hardcoded strings: `"admin"`, `"staff"`, `"tank"` appear in four files independently; there is **no single shared role constant** on the server (the closest is `auth/roles.ts` which only has `isAdminRole`).

### Authorization Basis by Operation

- **User management / maintenance / reset callables:** token claim **AND** Firestore doc (doc preferred). `tank` counts as admin.
- **AI callables (`askAdminAi` etc.):** `requireCallableAdmin` is imported into `askAdminAi` (confirmed via grep) — same doc-preferred pattern.
- **Client UI:** both token + doc, same resolution.

---

## 6. requireAdmin Audit

### Implementations

| File | Function | Auth check | Doc check | Disabled check | Deleted check | Error |
|---|---|---|---|---|---|---|
| `functions/src/auth/roles.ts` | `requireCallableAdmin` | yes | yes (preferred) | `active===false \|\| disabled===true` | `deleted===true` | `unauthenticated` / `permission-denied` |
| `functions/src/adminUsers.ts` | `requireAdmin` | yes (but `permission-denied` if no uid) | yes (preferred) | yes | yes | `permission-denied` |
| `functions/src/adminUserManagement.ts` | `assertAdmin` | yes | yes (preferred) | yes | yes | `unauthenticated` / `permission-denied` |

### Consistency

- All three **check the Firestore doc first and the token claim second**; all treat `tank` as admin; all gate on `request.auth` presence.
- **Inconsistencies:**
  1. `adminUsers.ts` throws `permission-denied` when `request.auth` is missing (should be `unauthenticated`); the other two throw `unauthenticated`. `createDashboardUser` adds a pre-check that throws `unauthenticated`, so the inner branch is dead code for that specific callable — but the helper is also the only gate and the duplicate path is confusing.
  2. Error messages differ ("Admin access required." vs "Only admins can create dashboard users.").
  3. `adminUsers.ts` and `adminUserManagement.ts` `initializeApp()` + call `getFirestore()`/`getAuth()` at module load; `auth/roles.ts` does not.
  4. No shared helper is used for the five user-management callables (`updateUserRole`, `disableDashboardUser`, `enableDashboardUser`, `deleteUserAccount`, `resetUserPassword`) — they use `assertAdmin`; creation uses `requireAdmin`. Drift risk.

### Security Risk Ranking

- **CRITICAL — `bootstrapAdminClaim`** (`functions/src/bootstrapAdmin.ts`): grants `role: admin` custom claims + Firestore doc to a **hardcoded UID** with no further verification. If an attacker gains control of that Firebase Auth account (or the UID is re-used), they receive admin privileges with no Firestore checks. Should be removed or replaced with a verified out-of-band flow.
- **HIGH — Missing/empty Firestore doc for a legit admin** causes `permission-denied`; there is no `getAuth().getUser` cross-check or "doc missing but claims admin" recovery path on the server side (the reverse — doc missing with claims admin — is allowed, which is the HIGH finding in §11).
- **MEDIUM — `trackQrScan` (`onRequest`) has no auth and writes to Firestore** (public write path).
- **MEDIUM — No shared role constants / three divergent implementations** create maintenance and drift risk.

---

## 7. User Creation Flow

### Trace (`createDashboardUser` — `functions/src/adminUsers.ts`)

```
UI (user-management page)
  → client httpsCallable("createDashboardUser")  [src/lib/adminUsers.ts]
  → enforceCallableRateLimit(request, "admin")
  → request.auth presence check → unauthenticated
  → requireAdmin(request)          [local, duplicated logic]
  → validatePayload (email, password ≥8, displayName, role normalized to "staff" default)
  → auth.createUser({email, password, displayName, emailVerified:false, disabled:false})
  → auth.setCustomUserClaims(uid, { role })
  → db.collection("users").doc(uid).set({uid,email,displayName,role,disabled:false,createdAt,updatedAt,createdBy}, {merge:true})
  → writeAuditEntry({action:"user_created", ...})
  → returns {success, uid, email, displayName, role}
  → UI refreshes user list
```

### Failure Points

1. Callable not deployed / Functions offline → `functions/not-found` or `functions/internal`.
2. Rate limit exceeded → `resource-exhausted` "Too many requests."
3. Not signed in → `unauthenticated` (correct).
4. **Signed in, but the admin gate rejects** → `permission-denied` (HTTP 403): the caller's Firestore doc is missing `role`, has `disabled:true`/`deleted:true`/`active:false`, **or** neither the doc role nor token role is `admin`/`tank`. **This is the most likely origin of the observed HTTP 403s** — the callable verification succeeded (the caller is a real Firebase user) but the application-level admin gate rejected them.
5. `auth/email-already-exists` → mapped to `already-exists` "That email address already exists."
6. `auth/insufficient-permission` (service account cannot manage users) → `permission-denied` with a diagnostic message. **Note: this is also surfaced as HTTP 403 to the client**, indistinguishable from application-level denial.
7. Claim set succeeded but doc write failed → user exists with claims but no doc → inconsistent state.
8. Doc set succeeded but audit write failed → no audit record (operation itself succeeded).

### 403 Conflation

The following all produce HTTP **403** on the client:
- Firestore platform `permission-denied` (e.g., rules block a client read);
- Application `permission-denied` from `requireAdmin`/`assertAdmin`;
- `auth/insufficient-permission` from the Admin SDK during `createUser`.

The client cannot distinguish these — all surface as `code === "permission-denied"` with the function's message. **Recommendation:** differentiate by using distinct HttpsError codes/messages and documenting the mapping (see §13).

---

## 8. Password Reset Flow

### Current Implementation (`resetUserPassword` — `functions/src/adminUserManagement.ts`)

- **Direct administrative password overwrite**: `auth.updateUser(uid, { password: newPassword })`.
- Validates length ≥ 8 (`requirePassword`).
- Writes `passwordResetAt` / `passwordResetBy` / `updatedAt` / `updatedBy` to the Firestore doc.
- Writes audit entry `user_password_reset`.
- Password is **never logged or persisted** (only the timestamp + actor). ✔

### Findings

- No Firebase password-reset email flow; no `generatePasswordResetLink`; no client-visible self-service password reset path found in this audit.
- **Risk — user enumeration:** the function accepts a `uid`, not an email, so enumeration risk is low; a nonexistent uid produces `auth/user-not-found` from Admin SDK which is **not mapped** in this file (only `adminUsers.ts` has a `mapAuthError`; `adminUserManagement.ts` has **no error mapping for any admin operation**).
- **Risk — plaintext transport:** password arrives in the callable `data` payload (HTTPS, short-lived, acceptable but should be noted); it is in memory only.
- **Risk — no recent-login gate:** the function does not require the actor to re-authenticate; a stolen valid admin token could reset any password. This is inherent to long-lived admin tokens; recommend documenting and optionally adding a confirmation step.

Recommendation: keep this as the administrative reset path (it matches the intended workflow), but add explicit error mapping and consider a "confirm reset for user X" UI step.

---

## 9. Delete / Disable Flow

### Current Semantics

**Disable (`disableDashboardUser`):**
- `auth.updateUser(uid, { disabled: true })` — blocks new sign-in/token issuance.
- Firestore doc `disabled: true`.
- Self-disable blocked (`failed-precondition`).
- **Does not clear custom claims** — stale tokens can still carry `role: admin` for a short window, but the `disabled` flag on the Auth account prevents refresh; server doc check also blocks.

**Enable (`enableDashboardUser`):**
- `auth.updateUser(uid, { disabled: false })`.
- Doc `disabled: false`.

**Delete (`deleteUserAccount`):**
- `auth.deleteUser(uid)` — **Auth account is permanently removed.**
- Firestore doc **soft-deleted**: `deleted: true, disabled: true, deletedAt, deletedBy`.
- Self-delete blocked.
- Audit record written.
- **Custom claims are not cleared** (Auth account no longer exists, so unavoidable; but the doc keeps the old `role`).

### Orphan-State Risks

| State | Behavior |
|---|---|
| Auth exists, doc missing | Server falls back to token role; if claims admin → admin access with **no doc checks** (active/disabled/deleted cannot be evaluated) |
| Doc exists, Auth deleted | Normal post-delete state; doc permanently blocks the uid from reuse |
| Claims stale but doc clean | Server prefers doc; role change effective immediately |
| Doc `disabled:true` but Auth not disabled | Server blocks via doc check; UI `AuthGuard` blocks/signs out; refresh token still valid → only server/doc blocks |

### Recommended Canonical Lifecycle (not yet implemented)

1. **Disable** = Auth disabled **+** doc `status:"disabled"` (replacing boolean trio).
2. **Delete** = Auth deleted **+** doc `status:"deleted"` + preserve audit snapshot (never hard-delete the doc).
3. Never reuse uid.
4. Claims: keep `role` only; rely on doc for status; treat missing doc as **deny** (fail-closed) except for emergency override.

---

## 10. Custom Claim Synchronization

### When Claims Are Set

- `createDashboardUser` → `{ role }`.
- `updateUserRole` → `{ role }` (replaces the whole claim object — wipes any other claims; none exist today).
- `bootstrapAdminClaim` → `{ role: "admin" }`.

### Refresh Behavior

- Client `AuthGuard` calls `getIdTokenResult(true)` — **force refresh** on every guard evaluation (page load / route change), so claim changes are picked up on next navigation within seconds.
- Stale tokens from before the claim change remain valid until expiry (default 1 hour), but **the server never trusts the token alone** — it also reads the Firestore doc, so role changes take effect **immediately** for doc-based operations even with a stale token.
- **Timing risk:** the reverse is also true — a *removed* admin still has valid claims for up to 1 hour, but the server doc check (`users/{uid}.role`) blocks them immediately if the doc was updated. Because `disableDashboardUser`/`deleteUserAccount` set doc flags, disabling/deleting **immediately** blocks privileged actions via the doc check even while claims persist.

### Claim-Refresh Requirements

- After `updateUserRole`: no server action needed (doc is authoritative); client will refresh on next guard pass.
- Recommend documenting: claims may lag ≤ 1h; doc changes are immediate; **never authorize from claims alone**.

---

## 11. Client / Server Trust Boundary

### Client-Side Authorization Decisions

- `AuthGuard` and `useAuthRole` — **UI visibility only**, correctly not treated as security enforcement.
- **No client path writes `role`, `disabled`, `deleted`, or `active`.** Client writes are limited to session-cookie creation (server-verified).

### Trust-Boundary Violations

| Finding | Severity |
|---|---|
| `bootstrapAdminClaim` grants admin by hardcoded UID without doc verification | **CRITICAL** |
| Server fallback: **doc missing + claims `admin` ⇒ admin allowed** (`requireCallableAdmin`/`requireAdmin`/`assertAdmin` all fall back to token when doc missing) | **HIGH** — a user whose doc was deleted, or a doc deleted in error, retains admin purely from stale claims; also, an admin created outside the dashboard (console) with claims set manually but no doc would pass |
| `updateUserRole` writes `role` to the doc and claims, and sets `disabled:false` — it **silently re-enables a previously disabled user** | MEDIUM |
| `trackQrScan` public Firestore write with no auth | MEDIUM |
| Admin SDK `auth/insufficient-permission` mapped to `permission-denied` → **client cannot distinguish service misconfiguration from authorization denial** | MEDIUM (error contract) |
| Client `AuthGuard` calls `auth.signOut()` for inactive docs — a user with `deleted:true` doc but valid Auth account gets signed out locally; server still needs doc check (it has one) | LOW |

No true "server trusts client-provided role/userId" violations were found in the inspected callables: every privileged callable derives identity from `request.auth` and re-reads the doc server-side. The **doc-missing + claims fallback** is the closest to a trust-boundary violation and should be tightened to fail-closed.

---

## 12. Firebase Functions Bootstrap Findings

### Current Architecture

`functions/src/index.ts` re-exports **all** triggers from ~20 modules, including heavy maintenance callables (`rebuildEverything`, `cleanDatabase`, `resetOperationalDatabase`), storage-triggered imports, AI callables, and user-management callables.

### Module-Level Side Effects Observed

- `functions/src/adminUsers.ts` and `functions/src/adminUserManagement.ts`:
  - `if (!getApps().length) initializeApp();`
  - `const db = getFirestore();`
  - `const auth = getAuth();`
- `functions/src/resetOperationalDatabase.ts`:
  - `const db = getFirestore();`
- Consistent pattern in other modules (storage-trigger imports call Firestore/Storage at module scope) — exact files behind storage triggers were not all re-read due to output corruption, but the pattern is confirmed in the files above.

### Coupling Risk

- **If any module throws during import** (e.g., `getFirestore()` without env/credentials, a bad import path, a config read), **the entire `index.ts` fails to load**, and **all** functions — including unrelated ones — fail to deploy/start.
- Previous symptom described in the task ("user-code load failures caused by missing Firebase configuration during local module loading") matches this: `initializeApp()` succeeds locally without config in some environments, but `getFirestore()` can throw if the project cannot be determined at load time; local emulator runs with `FIRESTORE_EMULATOR_HOST` unset can also fail.
- **Storage-trigger initialization** adds another coupling: if the Storage bucket/emulator configuration is missing at module scope, the same blast radius exists.

### Recommendation (not yet implemented)

- **Defer** all Firestore/Auth/Storage access to inside the trigger handlers (`const db = getFirestore()` inside each handler), or use lazy getters.
- Split maintenance/rebuild tools into a separate entrypoint (`index-maintenance.ts`) so their load failures cannot take down core user-management callables.
- Keep `setGlobalOptions` but avoid module-scope config that forces credential lookup at import time.

---

## 13. Error Contract Findings

### Error Codes In Use

| Domain | Code | Produced By |
|---|---|---|
| Auth missing | `unauthenticated` | `assertAdmin`, `createDashboardUser` precheck, `auth/roles.ts` |
| Auth missing (inconsistent) | `permission-denied` | `adminUsers.requireAdmin` (inner branch) |
| Not admin / disabled / deleted | `permission-denied` | All three admin gates |
| Invalid input | `invalid-argument` | `requireUid`, `requireRole`, `requirePassword`, `validatePayload` |
| Duplicate email / uid | `already-exists` | `mapAuthError` in `adminUsers.ts` only |
| Self-operation | `failed-precondition` | disable/delete self |
| Unknown server failure | `internal` | `mapAuthError` default; unhandled Admin SDK errors in `adminUserManagement.ts` |
| Rate limited | `resource-exhausted` | `rateLimit.ts` |

### Issues

1. **`adminUserManagement.ts` has no error mapping at all** — Admin SDK errors from `updateUser`, `deleteUser`, `setCustomUserClaims` propagate as unknown errors, producing generic `internal` from the Functions runtime. Missing `auth/user-not-found` handling means resetting a nonexistent user yields a confusing error.
2. **HTTP 403 conflation:** `permission-denied` is the *application* authorization error, but the client also receives HTTP 403 for `auth/insufficient-permission` (service account) and for Firestore rules denials in other paths. The callable SDK maps any `HttpsError("permission-denied")` to an error surfaced to the client — the client cannot distinguish causes.
3. **`unauthenticated` vs `permission-denied` inconsistency** in the two local gates.
4. No standardized success envelope (callables return `{ok/success, ...}` variably).

### Recommended Contract (future)

- `unauthenticated` — no/invalid token.
- `permission-denied` — authenticated but not allowed (doc check failed).
- `failed-precondition` — state conflict (self-disable, already deleted).
- `invalid-argument` — bad payload.
- `not-found` — target user doesn't exist (new).
- `already-exists` — duplicate email (mapped).
- `resource-exhausted` — rate limit.
- `internal` — unexpected; never leak stack traces; always log locally.
- Document in `src/lib/adminUsers.ts` that the client should match on the `code` string, not HTTP status.

---

## 14. Security Findings

| # | Severity | Finding | Location |
|---|---|---|---|
| 1 | **CRITICAL** | Hardcoded bootstrap UID with power to grant `role: admin` claims without Firestore verification | `functions/src/bootstrapAdmin.ts` |
| 2 | **HIGH** | Server authz falls back to token claims when Firestore doc missing ⇒ stale/absent doc still authorizes admins | `functions/src/auth/roles.ts`, `adminUsers.ts`, `adminUserManagement.ts` |
| 3 | **HIGH** | Three divergent admin-check implementations → audit drift | `functions/src/auth/roles.ts`, `adminUsers.ts`, `adminUserManagement.ts` |
| 4 | **HIGH** | No single source of truth for roles; hardcoded `"admin" / "staff" / "tank"` scattered | 4 server + client files |
| 5 | **MEDIUM** | Functions bootstrap: module-load side effects can take down the whole deployment | `functions/src/index.ts` + several modules |
| 6 | **MEDIUM** | Public `onRequest` writes (QR tracking) without auth | `functions/src/qr/trackQrScan.ts` |
| 7 | **MEDIUM** | Admin SDK errors unmapped in `adminUserManagement.ts` → internal errors, possible info leak in logs | `functions/src/adminUserManagement.ts` |
| 8 | **MEDIUM** | `updateUserRole` forces `disabled:false` silently re-enabling users | `functions/src/adminUserManagement.ts` |
| 9 | **MEDIUM** | Client Firebase config (API key, project ids) hardcoded in `src/lib/firebase/client.ts` — standard for web apps but should be env-driven and noted | `src/lib/firebase/client.ts` |
| 10 | **LOW** | No rate limit on `bootstrapAdminClaim` | `functions/src/bootstrapAdmin.ts` |

No committed secrets (service-account JSON, private keys) were discovered in the inspected files. The web API key is public-by-design and is flagged only for env migration.

---

## 15. Sources of Truth

| Property | Authoritative Source | Secondary / Duplicate | Notes |
|---|---|---|---|
| Identity / auth | Firebase Authentication | — | Non-negotiable |
| Email | Firebase Auth | Firestore `users/{uid}.email` | Written on create only; no sync on email change found |
| Role | Firestore `users/{uid}.role` (server reads doc first) | Custom claim `token.role` | **Duplicate.** Drift possible if one path fails mid-write |
| Active status | Firestore `users/{uid}.active` | — | Only set by bootstrap; `undefined` treated as active |
| Disabled | Firestore `users/{uid}.disabled` | Auth account `disabled` flag | **Duplicate.** Auth flag enforced by platform; doc flag by app |
| Deleted | Firestore `users/{uid}.deleted` | — | Soft-delete only |
| Audit trail | `auditLogs` (via `writeAuditEntry`) | — | Used by user ops; not by all maintenance ops |

**Roles have more than one source of truth (claims + Firestore doc).** The app mitigates by preferring the doc, but the fallback to claims when the doc is missing is a real gap.

---

## 16. Recommended Target Architecture

```
Firebase Authentication (identity, disabled flag)
        │
        ▼
Firestore users/{uid} (application profile + state)
  role: "admin" | "staff" | "tank"
  status: "active" | "disabled" | "deleted"   ← replace boolean trio
  email, displayName, timestamps, audit refs
  server-controlled only
        │
        ▼
Custom Claims (server-authorized hint only)
  { role } — set/removed only by privileged flows; never read alone
        │
        ▼
Central server authz helper (single implementation)
  requireCallableAdmin(actor):
    1. request.auth required → unauthenticated
    2. read users/{actor}
    3. doc missing → DENY (fail-closed) unless emergency flag
    4. status === "active"
    5. role in {admin, tank}
    6. return actor uid
        │
        ▼
Privileged operations (create/update/disable/enable/delete/reset/maintenance)
  → Firebase Admin SDK
  → write audit entries
```

### Authoritative Owners

| Property | Owner |
|---|---|
| Authentication | Firebase Auth |
| Role | Firestore doc (claims = hint) |
| Status | Firestore doc (`status` field; Auth `disabled` mirrors disable/enable) |
| Admin permission | Central server helper, used by every privileged callable |
| Audit | `auditLogs` collection |

---

## 17. Migration Risks

1. **Changing authz semantics** (doc-missing → deny) will break any admin whose Firestore doc is missing today — **audit existing admins first**.
2. **Replacing boolean trio with `status`** requires a data-backfill migration and must handle legacy docs (`active`, `disabled`, `deleted`) during a transition window.
3. **Removing `bootstrapAdminClaim`** may break first-run setup; must provide a replacement verified bootstrap flow (e.g., console-created doc + claims via a one-time secret).
4. **Split entrypoint** for Functions changes the deploy command surface; CI/deploy scripts must be updated.
5. **`updateUserRole` currently sets `disabled:false`** — changing this alters existing behavior; UI must explain re-enable semantics.
6. **Client `AuthGuard` behavior** for missing docs currently allows token-role access; changing to deny requires a coordinated client/server change.
7. **Error contract changes** will require `src/lib/adminUsers.ts` and tests to be updated together.

---

## 18. Files Likely To Change

| File | Reason |
|---|---|
| `functions/src/auth/roles.ts` | Central helper: fail-closed doc-missing behavior, single `isAdminRole`, status field |
| `functions/src/adminUsers.ts` | Use central helper; align error codes; map more Admin SDK errors |
| `functions/src/adminUserManagement.ts` | Use central helper; map errors; `updateUserRole` re-enable semantics; claims removal on disable/delete |
| `functions/src/bootstrapAdmin.ts` | Replace hardcoded-UID flow with verified bootstrap |
| `functions/src/index.ts` | Isolate entrypoints / lazy init |
| `functions/src/resetOperationalDatabase.ts`, maintenance files | Use central helper (already do), add audit + status checks |
| `src/lib/permissions/roles.ts` | Single client role model mirroring server |
| `src/app/components/auth/AuthGuard.tsx` | Handle `status` field; document deny-on-missing-doc |
| `src/lib/adminUsers.ts` | Align with new error contract |
| `src/app/api/auth/session/route.ts` | Verify CSRF + cookie hardening (read/verify in Stage 1) |

---

## Appendix: Commands Used (audit only)

- Repository discovery via `list_files`, `search_files`, and shell `ls`/`grep` equivalents
- Targeted `read_file` of the files listed in §18 and the audit body
- No deploy, no Firebase CLI, no user mutation