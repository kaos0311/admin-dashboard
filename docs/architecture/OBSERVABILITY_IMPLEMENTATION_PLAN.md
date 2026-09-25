# Observability & Diagnostics Implementation Plan

**Repository:** Advanced Home Medical Admin Dashboard
**Companion document:** `OBSERVABILITY_AUDIT.md` (findings, error model, logger design)
**Principle:** Each stage is small, independently reviewable, revertible, and additive. No stage changes business logic, Firebase security rules, or inventory workflow behavior.

---

## Stage 0 — Emergency Redaction Guardrail (do first)

**Files affected**
- `src/lib/adminUsers.ts`
- `src/lib/logger.test.ts` (new) or `src/lib/__tests__/logger.test.ts` (new)

**Intended changes**
- Remove the `console.log("[adminUsers] Preparing", payload)` call; replace with a redacted summary: `{ email, role, displayName, hasPassword: true }` — never the password value.
- Remove `payload` serialization from the `"succeeded"` and `"failed"` log lines; log `${functionName}:${outcome}` plus the function name only.
- Add a regression test asserting serialized log output never contains `password`, `newPassword`, or a real email body.
- Do not touch callable payloads, server logic, or UI behavior.

**Risks**
- None functional; logging-only change. Risk of "redaction by omission" only — mitigations: assert in test.

**Validation commands**
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

**Rollback**
- Revert the single commit. Zero data/behavior impact.

---

## Stage 1 — Shared AppError Model

**Files affected**
- `src/lib/errors/appError.ts` (new)
- `src/lib/errors/errorCategories.ts` (new)
- `functions/src/errors/appError.ts` (new)
- `functions/src/errors/errorCategories.ts` (new)
- `src/lib/__tests__/appError.test.ts` (new)
- `functions/src/errors/appError.test.ts` (new)

**Intended changes**
- Implement the `AppError` class exactly as specified in `OBSERVABILITY_AUDIT.md` §9 (code, category, userMessage, operation, severity, source, correlationId, timestamp, metadata, originalError — `toClientPayload()` strips metadata/originalError).
- Define the 14 categories: `AUTH | PERMISSION | VALIDATION | NOT_FOUND | CONFLICT | DATABASE | FIREBASE | NETWORK | INVENTORY | MOVEMENT | SCAN | USER_MANAGEMENT | SYSTEM | UNKNOWN`.
- Provide pure functions on both sides: `fromFirebaseError(error)`, `fromHttpsError(error)`, `fromUnknown(error, fallback)`, `toClientPayload(error)`.
- No call sites migrated yet — the model is additive.

**Risks**
- Low: new code, no production callers yet. Keep the server and client files byte-identical in shape but physically separate (different build roots).

**Validation**
- `npm run lint && npm run typecheck && npm run test`
- `cd functions && npm run test && npm run build`

**Rollback**
- Delete the new modules; nothing depends on them.

---

## Stage 2 — Logger Abstraction With Redaction

**Files affected**
- `src/lib/logger.ts` (new)
- `functions/src/utils/logger.ts` (new)
- `src/lib/logger.test.ts` (new, if not created in Stage 0)
- `functions/src/utils/logger.test.ts` (new)
- (both use `src/lib/errors/*` / `functions/src/errors/*` from Stage 1)

**Intended changes**
- `logger.debug/info/warn/error(message, meta?)` that serializes `meta` through a redaction walker.
- Redaction key list: `password`, `newPassword`, `token`, `idToken`, `refreshToken`, `authorization`, `cookie`, `apiKey`, `secret`, `privateKey`, `accessToken`, `sessionToken`, `claims`, `customData`; PHI patterns: email regex, phone/SSN/insurance patterns, MRN, `aiPrompt`, `aiResponse`, known healthcare field names.
- Client: honor `NODE_ENV !== "production"` for `debug`; `warn`/`error` always on.
- Server: emit one JSON line per event; map severities to Cloud Logging levels; keep `console.error` as final fallback only.
- Do not wire production call sites in this stage beyond tests.

**Risks**
- Low. Minor: redaction must not hide the `errorCode`/`code` needed for debugging — the walker only masks sensitive *values*, never keys like `errorCode`.

**Validation**
- `npm run lint && npm run typecheck && npm run test`
- `cd functions && npm run test && npm run build`

**Rollback**
- Delete modules; no call sites depend on them yet.

---

## Stage 3 — Server / Callable Boundary Adoption (INVENTORY + USER MANAGEMENT first)

**Files affected**
- `functions/src/inventory/movementFunctions.ts`
- `functions/src/inventory/movementService.ts`
- `functions/src/inventory/inventoryTransactionFunctions.ts`
- `functions/src/adminUsers.ts`
- `functions/src/adminUserManagement.ts`
- `functions/src/auth/createSessionCookie.ts`
- `functions/src/passwordReset.ts`
- `functions/src/security/auditLog.ts` (a small enrichment: include `correlationId` in payload when present)

**Intended changes**
- Wrap each callable body with a single `withErrorHandling(fnName, handler)` helper (new tiny module `functions/src/utils/withErrorHandling.ts`) that:
  - catches `HttpsError` → rethrows unchanged;
  - catches `AppError` → converts via `toHttpsError` (same code mapping `AppErrorCategory` → `FunctionsErrorCode`);
  - catches unknown → logs structured (operation, category=SYSTEM, severity=error) and throws `HttpsError("internal", "internal-error")`;
  - attaches `correlationId` to structured logs.
- Replace `console.error` in these files with `logger.error(..., {operation, correlationId, userId, productId, locationId, errorCode})`.
- Convert `mapAuthError` in `adminUsers.ts` to log via `logger.error` with category `USER_MANAGEMENT` and redacted auth metadata (never the raw Auth error object).
- Behavior (validation, preconditions, transactions, idempotency) unchanged. Only logging/error mapping.
- Add unit tests: `functions/src/inventory/movementFunctions.test.ts` (if not present) asserting HttpsError mapping and one structured log line; `functions/src/adminUsers.test.ts` asserting no password in logs.

**Risks**
- MEDIUM: `movementService.ts` is the transaction core; only the *logging and error classification* changes. Must not alter transaction ordering or writes. Mitigation: identical diff review vs the movement workflow rules; run emulator tests.
- Ensure the server envelope (`{ok:false, error:{...}}`) is **not** yet returned — callables keep throwing `HttpsError` in this stage; the envelope arrives in Stage 5.

**Validation**
- `npm run test`
- `npm run validate:inventory-writes`
- `npm run validate:domain-writes`
- `cd functions && npm run test && npm run build`
- `npm run emulators:test` (functions integration)
- `npm run lint && npm run typecheck`

**Rollback**
- Revert the commit. No schema/rule/business change involved.

---

## Stage 4 — Firebase Functions Logging Wiring

**Files affected**
- `functions/src/index.ts`
- `functions/src/logging/logger.ts` (tiny startup wrapper, if desired)
- `functions/package.json` (only if a transport is added — e.g. `@google-cloud/logging`; prefer zero-dep JSON lines first)

**Intended changes**
- Add a module-level invocation logger wrapper that emits one structured line per invocation: `{ type: "function.invocation", function, invocationId, correlationId, durationMs, outcome: "started"|"succeeded"|"failed" }`.
- Use `onCall`'s provided `runWith`/context where available; fall back to reading `X-Cloud-Trace-Context`.
- Wire `process.on("unhandledRejection")` / `process.on("uncaughtException")` logging in dev only (never swallow in prod).
- No business logic changes.

**Risks**
- Low. Cloud Functions v2 already publishes default invocation logs; this layer adds structured correlation fields, not new instrumentation.

**Validation**
- `cd functions && npm run build && npm run test`
- `npm run emulators:test`
- Deploy flow: `firebase deploy --only functions` in staging.

**Rollback**
- Revert flag/transport lines; invocation logs fall back to default Cloud Functions behavior.

---

## Stage 5 — Client Error Normalization

**Files affected**
- `src/lib/errors/toAppError.ts` (new — client-side mapper using Stage 1 model)
- `src/lib/adminUsers.ts` (adopt `AppError.fromFirebaseError`; remove `cleanMessage` code-stripping)
- `src/lib/inventory.ts`
- `src/lib/inventory/smartMergeInventory.ts`
- `src/lib/firestoreWriteQueue.ts`
- `src/lib/firestoreSafeActions.ts`
- `src/lib/auth/session-client.ts`
- `src/repositories/firestore/inventory.repository.ts`
- `src/repositories/firestore/order.repository.ts`
- `src/repositories/firestore/product.repository.ts`
- Hooks in `src/app/(admin)/**/*hooks*` (settings, inventory, orders, reports, command-center) — replace `console.error(...)` + `new Error(message)` with `AppError` + `logger.error`.
- `src/app/components/**` and pages with try/catch that render errors (toast/inline) — adopt `userMessage` only.
- `src/lib/__tests__/toAppError.test.ts` (new)

**Intended changes**
- Map `FirebaseError`/`FunctionsError`/`Error` → `AppError` at the single boundary (`toAppError`), preserving `code`, `customData`, `operation`, `correlationId` when present.
- Every UI catch renders `error.userMessage` (never raw `error.message` of unknown origin).
- Remove repeated per-hook `console.error` lines; replace with at most one `logger.error` per failure at the boundary.
- Keep behavior: toasts still appear, messages still set — text may become more precise (code-derived).

**Risks**
- MEDIUM: broad file surface; must not change which user-visible message a failure produces *semantically* (validate each re-mapped message against existing toasts/tests). Mitigation: per-file diffs reviewed; hooks layer touched last after libs.

**Validation**
- `npm run lint && npm run typecheck && npm run test`
- `npm run build`
- Manual: exercise Settings user CRUD, inventory move, import upload, orders list (error injection via emulator rules).

**Rollback**
- Revert the commit. Envelope/logger utilities become unused without breaking runtime.

---

## Stage 6 — Correlation IDs

**Files affected**
- `src/lib/correlation.ts` (new — `createCorrelationId()` using `crypto.randomUUID`)
- `src/lib/adminUsers.ts` (pass `correlationId` in payloads)
- `src/lib/inventory.ts`, `src/lib/inventory/smartMergeInventory.ts`
- `src/app/(admin)/**/*hooks*` (generate once per user action, pass into lib functions)
- `src/app/api/**` routes (read `x-correlation-id` header; fall back generate; emit in logs)
- `functions/src/inventory/movementFunctions.ts`, `movementService.ts` (use `input.correlationId` — field already exists in `CreateMovementInput` and persists to `inventoryTransactions`)
- `functions/src/security/auditLog.ts` (persist `correlationId` to `auditLogs` entries when supplied)
- `functions/src/utils/logger.ts` (auto-attach `correlationId` from request context when not supplied)

**Intended changes**
- Client: each user-initiated operation (create user, move inventory, import, order mutation, settings save) generates one UUID and threads it through to the callable/API.
- Server: reads it from payload/header, logs it on the invocation line and every structured event; persists to `inventoryTransactions.correlationId` (already supported), `auditLogs.correlationId`, and `inventoryOperations`.
- UI: admin-only "Copy trace id" affordance on the error toast/detail (when `userMessage` render includes an optional `correlationId`).

**Risks**
- LOW-MEDIUM: touches many touchpoints; no behavior change — if a caller forgets to generate an id, server-generates one. Ensure payload types allow optional `correlationId` (they already do for movement; extend other payload types).

**Validation**
- `npm run lint && npm run typecheck && npm run test`
- `npm run validate:inventory-writes`
- `cd functions && npm run test && npm run build && npm run test:emulator`
- End-to-end: run an inventory movement in emulator; assert one `correlationId` in `inventoryTransactions` + `auditLogs` + both log lines.

**Rollback**
- Revert commit. Old clients simply omit the field.

---

## Stage 7 — Health Endpoint

**Files affected**
- `src/app/api/health/route.ts` (new)
- `src/lib/health/firebaseProbe.ts` (new)
- `src/lib/health/firebaseProbe.test.ts` (new)
- `scripts/toolkit/health-check.ps1` (add `-ProbeRuntime` switch)
- `scripts/Get-ProjectHealth.ps1` (optional alias to the same probe)
- `scripts/toolkit/health-check.ps1` README/docs (in `scripts/toolkit/README.md`)

**Intended changes**
- GET `/api/health` returning `{ status, version, buildTime?, uptime, timestamp, services: { application, firebase } }` — no secrets, env, paths, credentials, or internal infra details (per OBSERVABILITY_AUDIT §12).
- `firebaseProbe.ts`: admin SDK `db.collection("health").doc("probe").get()` with 3–5 s timeout; cache 30 s; respect emulator host; guard so the probe never writes.
- PowerShell: when `-ProbeRuntime` is passed, `Invoke-RestMethod http://localhost:3000/api/health`; treat `status != healthy` or `services.firebase != healthy` as a failed check; keep existing exit-code contract (0 = all critical passed).

**Risks**
- LOW. New route, no callers changed. Must never echo `process.env` or config; add a test that asserts the response shape contains no `NEXT_PUBLIC_`, no `apiKey`, no `authDomain`, no `projectId`, no filesystem paths.

**Validation**
- `npm run lint && npm run typecheck && npm run test && npm run build`
- Manual: `npm run dev` → hit `/api/health` in browser and curl; run `.\scripts\toolkit\health-check.ps1 -ProbeRuntime`.
- Emulator: run with `FIRESTORE_EMULATOR_HOST` set and confirm `services.firebase: healthy`.

**Rollback**
- Revert route + flag. No other consumers depend on it.

---

## Stage 8 — Admin Diagnostics Page

**Files affected**
- `src/app/(admin)/system-health/page.tsx` (new)
- `functions/src/diagnostics/getSystemDiagnostics.ts` (new, admin-only callable)
- `src/lib/adminDiagnostics.ts` (new client lib wrapping the callable)
- `src/app/(admin)/system-health/hooks/useSystemHealth.ts` (new)
- (reuses `InfoCard`/`Field` patterns from `settings/components`)

**Intended changes**
- Admin-only page (guarded by the same role checks as `AuthGuard` and `functions/src/diagnostics` `requireAdmin`).
- The callable aggregates *counts and last-timestamps only*: recent `error`/`critical` events from an `appErrors` collection (written by the Stage 2/3 logger for server-side `error`/`critical` only — never PHI), Firebase probe status, Cloud Function "last known running" from recent `auditLogs`, uptime/version/build, and a sanitized health-check status string.
- The page renders cards; never exposes raw logs, payloads, or stack traces to the browser.
- No business logic, no rules changes.

**Risks**
- MEDIUM: new collection `appErrors` and a new callable. Ensure: (a) `appErrors` writes are server-only (callables with admin checks); (b) no client writes to `appErrors`; (c) `appErrors` contains no patient identifiers; (d) rules for `appErrors` deny client writes and allow only admin reads if ever exposed.

**Validation**
- `npm run lint && npm run typecheck && npm run test && npm run build`
- `cd functions && npm run test && npm run build`
- `npm run emulators:test`
- Manual: sign in as admin → view page; as staff → page absent/guard redirects.

**Rollback**
- Revert commit. `appErrors` writes stop; page disappears; no data loop.

---

## Stage 9 — Remove Obsolete Console Logging

**Files affected**
- Every file listed in OBSERVABILITY_AUDIT §15 "Modified — client/functions" that still has `console.*` (all 98 files with matches).
- `scripts/_scan_console.cjs` (repurpose as the gate: `node scripts/check-console.cjs` — fail CI on any `console.*` in `src/` and `functions/src/`).
- `scripts/_scan_errors.cjs`, `_tess_scan_health.cjs`, `_tess_secret_scan.cjs`, `_ttess_scan_bak.cjs` (consolidate into one `scripts/check-observability.cjs`).
- `.gitignore` (add `*.txt` artifacts, `nul`, `0`, `sh.cmd`, `out.txt`, `tsc_output.txt`, `tsc_trace.txt`).

**Intended changes**
- Replace remaining runtime-paths `console.*` with `logger.*` calls using proper `operation`/`correlationId`/severity metadata.
- Scripts may keep bounded `process.stdout.write`/`console.log` for CLI UX, but runtime paths (`src/`, `functions/src/`) must reach zero raw console calls.
- Add CI gate failing if `node scripts/check-console.cjs` finds matches in runtime paths.

**Risks**
- MEDIUM (mechanical churn across 98 files). Mitigation: per-directory batches with green gates; script-level fuzz: the gate itself must not false-positive on `.test.ts` files (allow tests to use `vi.spyOn(console)` patterns).
- Ensure no `console.*` is replaced by a silent no-op — every replacement must produce a structured log line.

**Validation**
- `npm run lint && npm run typecheck && npm run test != all green`
- `npm run build`
- `cd functions && npm run build && npm run test`
- `npm run validate:inventory-writes && npm run validate:domain-writes`
- `npm run emulators:test`
- `node scripts/check-console.cjs` → exit 0

**Rollback**
- Revert in batches. Each batch is independent.

---

## Cross-Stage Validation Gates

| Gate | Stages |
|---|---|
| `npm run lint` | all |
| `npm run typecheck` | all |
| `npm run test` | all |
| `npm run build` | all |
| `npm run validate:inventory-writes` | 3, 6, 9 |
| `npm run validate:domain-writes` | 3, 6, 9 |
| `cd functions && npm run test && npm run build` | 1–9 |
| `npm run emulators:test` | 3, 4, 6, 8, 9 |
| `node scripts/check-console.cjs` (exit 0) | 9 |

**Rule:** no stage may weaken `firestore.rules`, `storage.rules`, client guards, or inventory workflow behavior. Every stage must be a strict superset of prior observability behavior (log lines may change shape, never reduce coverage of `error`/`critical` events).