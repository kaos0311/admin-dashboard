# Observability & Diagnostics Architecture Audit

**Repository:** Advanced Home Medical Admin Dashboard
**Date:** Audit performed on current working tree
**Scope:** `app/`, `components/`, `hooks/`, `lib/`, `services/`, `repositories/`, `functions/`, `scripts/`, health-check tooling, deployment/startup scripts
**Audit type:** Inspection + design (no production code changed)

---

## 1. Executive Summary

The dashboard has **no unified observability architecture**. All diagnostics are raw `console.*` calls (446 calls across 98+ files) with no structured logging, no shared error model, no correlation IDs, no runtime health endpoint, and no admin diagnostics surface. The system is otherwise well-engineered at the domain layer (inventory movements are transactional, idempotent via `operationId`, and audit-logged).

One **CRITICAL** defect was confirmed by direct code inspection: `src/lib/adminUsers.ts` logs the **full request payload to the browser console on every admin user-management call**, which includes the **plaintext temporary password** on `createDashboardUser` and `resetUserPassword`. In a healthcare-adjacent system this is a credential and PII exposure event reproducible by any admin opening DevTools.

Secondary high-risk issues: Firebase error codes are destroyed at the client boundary (`cleanMessage` strips them), errors are logged 2–4 times per failure path, several failure paths silently swallow per-collection or fire-and-forget errors, and the existing PowerShell health-check tooling performs only static environment checks — it never probes the running application or Firebase.

The report ends with a concrete staged implementation plan (see companion document `OBSERVABILITY_IMPLEMENTATION_PLAN.md`).

**Overall risk today: HIGH. No release-blocking defect was introduced by this audit; the findings below are defects already present in the working tree.**

---

## 2. Current Logging Architecture

- **No logging library.** Neither `package.json` nor `functions/package.json` contains `winston`, `pino`, `pino-pretty`, `@google-cloud/logging`, `sentry`, or any structured logger. `console.*` is the only mechanism.
- **Measured console surface** (via `scripts/_scan_console.cjs`):

  | Level | Calls | Files |
  |---|---|---|
  | `console.error` | 220 | 98 |
  | `console.log` | 211 | 43 |
  | `console.warn` | 15 | 11 |
  | `console.info` / `debug` | 0 | 0 |

- **Top offenders by call count:**
  - Scripts: `scripts/par-cpap-crossref.tsx` (23), `scripts/import-par-report.ts` (16), `scripts/repairUsers.ts` (14), `scripts/inspect-phiAlerts.ts` (13).
  - Client: `src/app/(admin)/settings/use-settings-page.ts` (14 — legacy copy), `src/app/(admin)/settings/hooks/use-settings-page.ts` (8), `src/app/(admin)/inventory/hooks/useInventoryActions.ts` (9), `src/lib/adminUsers.ts` (7).
  - Functions: `functions/src/imports/importFileFromStorage.ts` (12), `functions/src/ai/askAdminAi.ts` (6), `functions/src/ai/callable/scanDatabasePhiSafety.ts` (1), `functions/src/adminUsers.ts` (1, plus legacy `adminUserManagement.ts`).
- **Client diagnostics** are ad-hoc prefix strings (`[adminUsers]`, `[Settings]`, `[UserCreateCard]`, `[Inventory]`, ...) with no common origin, no level filtering in production, and no redaction.
- **Server diagnostics** rely on Firebase Cloud Functions' default invocation logs. Structured application-level logging (function name, invocation id, duration, outcome, correlation id) does not exist.
- **Existing diagnostic utilities:** `scripts/_scan_console.cjs`, `scripts/_scan_errors.cjs`, `scripts/_tess_scan_health.cjs`, `scripts/_tess_secret_scan.cjs`, `scripts/toolkit/health-check.ps1`, `scripts/Get-ProjectHealth.ps1`, `scripts/Get-ReleaseReadiness.ps1`, `scripts/Invoke-ProjectValidation.ps1`. These are developer tooling, not runtime observability.

---

## 3. Current Error Flow

### Inventory movement (representative healthy path)

```
Client hook (useInventoryActions)
  → src/lib/inventory / inventoryMovements lib
    → httpsCallable / server action
      → functions/src/inventory/movementFunctions.ts
        → movementService.createInventoryMovement (Firestore transaction:
           inventory + inventoryTransactions + inventoryOperations + auditLogs
           + patient.equipment + patient.timeline)
          → throws HttpsError on validation / precondition / not-found
        ← HttpsError (firebase-functions v2)
    ← FirebaseError { code: "functions/...", message contains HttpsError text }
  → client catch: console.error ×1–2, error → generic new Error(message)
→ toast / inline message set by hook
```

### User management (representative noisy path — 3–4 logs per failure)

```
UserCreateCard.handleCreateUser
  → hook createUserDraft (use-settings-page)
    → lib callFunction (src/lib/adminUsers.ts)
      1. console.log("[adminUsers] Preparing <fn>", payload)   ← PASSWORD LEAK
      2. verifyCurrentUser → console.log("[adminUsers] Current auth state",
         {uid,email}) + console.log("token claims", claims)
      3. console.log("[adminUsers] Calling <fn>")
      4. catch → console.error ×2 (Firebase details w/ customData+stack)
         → throw new Error(cleanMessage(error.message))  ← CODE STRIPPED
    → hook catch → console.error("[Settings] ...") → setMessage(error.message)
  → component catch → console.error("[UserCreateCard] ... failed")   // log #3
→ message rendered by Settings page (no toast component)
```

### Observations

| Concern | Where it happens |
|---|---|
| Error context lost | `cleanMessage()` strips `Firebase:` prefix and `(functions/code)` suffix; `customData` and `stack` never forwarded |
| Firebase code disappears | `src/lib/adminUsers.ts` `getErrorMessage`/`cleanMessage` |
| Errors logged multiple times | lib (2) + hook (1) + component (1) = 4 console lines per failure |
| Errors never logged | No logging in many pure service/repository success/partial paths; `setPersistence().catch(console.error)` fire-and-forget wrapper in `src/lib/firebase.ts`; `scanDatabasePhiSafety` per-collection `.catch` returns zeroed results with no alert |
| Stack traces disappear | Errors rethrown as `new Error(message)` with no stack; only the lib retains `error.stack` in a console.* call |
| User ID / operation useful | Verified absent: no uid in most log lines; `operationId` exists only in the movement domain; never propagated to logs or client |
| Correlation IDs improve tracing | Confirmed — `correlationId` field already exists in `CreateMovementInput` and is persisted to `inventoryTransactions`, but is never generated client-side or threaded through the UI |

---

## 4. High-Risk Findings

### CRITICAL

- **C1 — Plaintext credentials logged to browser console.**
  `src/lib/adminUsers.ts` line ~120:
  ```ts
  console.log(`[adminUsers] Preparing ${functionName}`, payload);
  ```
  `callFunction` is the generic wrapper for all admin user operations. The `createDashboardUser` payload contains `password`, and `resetUserPassword` contains `newPassword`. Any admin who opens DevTools on the Settings page will see temporary passwords in clear text. This is a reproducible credential exposure and a PII/PHI hygiene failure (temporary passwords are often also the employee's new credential).

- **C2 — No redaction layer for error/payload logging in a healthcare system.**
  Error objects flow to `console.error` unfiltered in patient, import, AI, and analytics paths: `functions/src/patients/bulkPatientImport.ts`, `createPatient.ts`, `updatePatient.ts`, `functions/src/analytics/patientIndex.ts`, `functions/src/ai/askAdminAi.ts`, `functions/src/imports/importFileFromStorage.ts`, `src/app/components/patients/PatientDocumentsPanel.tsx`. In several of these, the logged object can contain patient names, emails, notes, AI prompt content, or import payload samples. The database PHI scanner itself (`scanDatabasePhiSafety.ts`) classifies `note|notes|comment|message|preview|search|raw|text|ocr|parsed|reason|issue|details|content` fields as high-risk — the same kinds of fields appear in unredacted console payloads.

### HIGH

- **H1 — Firebase error codes and server context destroyed at client boundary.**
  `cleanMessage()` in `src/lib/adminUsers.ts` strips the Firebase error code; the hook then receives `new Error(cleanMessage(...))`. UI shows generic text and the operator cannot distinguish permission-denied, quota, timeout, or invalid-argument — and cannot correlate to a server log line.

- **H2 — Partial failures silently swallowed.**
  `scanDatabasePhiSafety` wraps per-collection scans in `.catch`, logs the error, then returns an empty scan and lets the whole call return `ok: true`. A failing collection silently reduces scan coverage. No alert is raised, and the error detail is only in function logs.

- **H3 — Duplicate + inconsistent error handling across the stack.**
  Every hook repeats the same try/catch → `console.error` → `setMessage` pattern with slightly different text/prefixes. There is no single `toUserMessage(error)` or `logError(error, context)` helper. This drives the 220 `console.error` call sites.

### MEDIUM

- **M1 — No structured server-side logs.**
  No function-level log lines carry `functionName`, `invocationId`, `durationMs`, `outcome`, or `uid`. Cross-service traceability today requires grepping timestamped Cloud Functions default logs.

- **M2 — No runtime health endpoint (`/api/health` missing).**
  Only `auth/session`, `chatgpt`, `equipment`, `improvements`, and `jarvis` API routes exist. The AHM PowerShell health checks (`scripts/toolkit/health-check.ps1`) verify Node/npm/git/CLIs, `node_modules`, config-file presence, env presence, and disk — all static; they never probe the running Next.js app or Firebase connectivity.

- **M3 — No admin diagnostics surface.**
  There is no System Health/Diagnostics page; operators cannot view recent app errors, Firebase connectivity, Cloud Function availability, or deployment version from the UI.

### LOW

- **L1 — Untracked service-account file on disk.**
  `scripts/serviceAccountKey.json` exists locally and is **not tracked** by git (verified via `git ls-files`). It must remain ignored; a pre-commit guard or `git check-ignore` assertion is recommended so it can never be committed.

- **L2 — Repository pollution from CLI scanning patterns.**
  Untracked junk at repo root: `out.txt`, `nul`, `0`, `sh.cmd`, `console.error('IMPORT...`, `bearer-scan.txt`, `cookie-scan.txt`, `logout-scan.txt`, `tsc_output.txt`, `tsc_trace.txt`. These are byproducts of console-redirected scripts on Windows and should be cleaned and added to `.gitignore`.

- **L3 — Duplicate logging helper scripts.**
  `scripts/_scan_console.cjs`, `_scan_errors.cjs`, `_tess_scan_health.cjs`, `_tess_secret_scan.cjs`, `_ttess_scan_bak.cjs` overlap; two should be consolidated.

---

## 5. PHI/PII Logging Risks

| Location | Content logged | Risk |
|---|---|---|
| `src/lib/adminUsers.ts` `callFunction` | full payload incl. plaintext `password` / `newPassword` | **CRITICAL** — credential exposure in DevTools |
| `src/lib/adminUsers.ts` `verifyCurrentUser` | `email`, `uid`, full token `claims` | HIGH — PII emitted on every call |
| `functions/src/adminUsers.ts` `mapAuthError` | raw Auth error object (`code`, `message`, `stack`) | MEDIUM — may include email on `auth/email-already-exists` |
| `functions/src/ai/askAdminAi.ts` (6 calls) | AI prompts/answers/error objects | HIGH — may embed patient data from chat context |
| `functions/src/patients/*.ts`, `bulkPatientImport.ts` | import/patient error objects | HIGH — payload samples may include PHI |
| `functions/src/analytics/patientIndex.ts` | analytics processing errors | HIGH — patient index documents are PHI-adjacent |
| `functions/src/imports/importFileFromStorage.ts` (12 calls) | import job state/errors | MEDIUM — may include filenames/rows with PHI |
| `src/lib/firebase.ts` | auth persistence error object | LOW — unlikely PHI, still noisy |
| `functions/src/inventory/movementService.ts` | **none** (no console calls) | None — model for the rest of the app |

**Standard:** treat any string field from `patient*`, `import*`, `ai*`, `order*`, `rental*`, `insurance*` collections as potentially PHI. The redaction list must cover names, DOB, medical-record numbers, insurance IDs, addresses, phone numbers, notes, and AI prompt/response bodies.

---

## 6. Duplicate Logging Patterns

1. **User management (worst path):** lib logs 2–4 lines, hook logs 1, component logs 1, plus inline message state. Total ~4–6 log lines per failure.
2. **Settings page:** 7 operations × identical try/catch → `console.error` → `setMessage` blocks in one hook file.
3. **Inventory hooks:** hook + repository + lib patterns (`useInventoryActions`, `inventory.repository.ts`, `inventoryMovements.ts`) each log the same original error at different layers.
4. **Client functions:** `callFunction` logs `Preparing`, `Calling`, `succeeded`, and `failed` + `Firebase details` — 4–5 lines per operation, before the hook/component emit their own.
5. **Functions admin paths:** `adminUsers.ts` and legacy `adminUserManagement.ts` both exist with overlapping console coverage.

---

## 7. Missing Logging

- No request lifecycle log on the server (function, invocation, duration, outcome).
- No `uid`/`operationId` on most client and server log lines.
- No authenticated-versus-anonymous visibility into which admin/role triggered an operation.
- No health/availability events (app boot, Firebase connect success/failure, function warm/cold).
- No structured error event sink (Cloud Logging severity field, `serviceContext`, `reportLocation` for Cloud Error Reporting).
- No logging around Firestore rules-denied reads/writes from the client (permission errors surface only as raw Firebase console noise).
- No logging around the scan (`_scan_*` scripts), verify (`validate:inventory-writes`, `validate:domain-writes`) runs from the app side.
- No deployment/version tag in logs.

---

## 8. Error Handling Problems

1. **Code stripping:** `cleanMessage` destroys `functions/<code>`; the client cannot branch on or display the canonical code.
2. **Generic rethrow:** `throw new Error(getErrorMessage(error))` loses stack, `customData`, and the original error reference.
3. **Partial-failure masking:** `scanDatabasePhiSafety` returns `ok:true` with zeroed collections after per-collection throws.
4. **Fire-and-forget:** `auth.setPersistence(...).catch(console.error)` in `src/lib/firebase.ts` — unhandled rejection path masked by a log line.
5. **Mixed error types:** hooks must handle `FirebaseError` (Firestore SDK), `FunctionsError` details, `Error`, and `HttpsError` codes with no unified type.
6. **Toast inconsistency:** some flows use inline `message` state (settings), some hooks feed `react-hot-toast` (dependency present), some do nothing visible.
7. **No rate-limit visibility:** `functions/src/security/rateLimit.ts` enforcement exists (used by `createDashboardUser`) but rate-limit denials are not differentiated from other `permission-denied` at the client.

---

## 9. Proposed AppError Model

New shared module (client: `src/lib/errors/appError.ts`; server: `functions/src/errors/appError.ts` — keep identical shape).

```ts
export type AppErrorSource =
  | "client" | "server-action" | "api-route"
  | "callable" | "repository" | "service" | "firebase";

export type AppErrorCategory =
  | "AUTH" | "PERMISSION" | "VALIDATION" | "NOT_FOUND" | "CONFLICT"
  | "DATABASE" | "FIREBASE" | "NETWORK" | "INVENTORY" | "MOVEMENT"
  | "SCAN" | "USER_MANAGEMENT" | "SYSTEM" | "UNKNOWN";

export class AppError extends Error {
  readonly code: string;            // stable machine code, e.g. "INVENTORY_NEGATIVE_STOCK"
  readonly category: AppErrorCategory;
  readonly userMessage: string;     // safe for UI
  readonly operation: string;       // e.g. "inventory.move"
  readonly severity: "debug" | "info" | "warning" | "error" | "critical";
  readonly source: AppErrorSource;
  readonly correlationId?: string;
  readonly timestamp: string;       // ISO
  readonly metadata?: Record<string, unknown>; // redacted, serializable
  readonly originalError?: unknown; // server-side only; never serialized to client

  constructor(input: {
    code: string; category: AppErrorCategory; userMessage: string;
    operation: string; severity?: AppError["severity"]; source: AppErrorSource;
    correlationId?: string; metadata?: Record<string, unknown>;
    originalError?: unknown;
  }) { /* ... */ }

  toClientPayload(): {
    code: string; category: AppErrorCategory; userMessage: string;
    operation: string; correlationId?: string;
  } { /* NEVER include metadata/originalError here */ }
}
```

Client transport contract:

```ts
type ErrorEnvelope = {
  ok: false;
  error: { code; category; userMessage; operation; correlationId? };
};
```

Rules:
- Never serialize `originalError`, `metadata`, stack traces, server paths, or env names to the browser.
- `userMessage` is the only string the UI may render or toast.
- Map `HttpsError`/`FirebaseError` codes into `AppErrorCategory` in one place on each side.

---

## 10. Proposed Logger Architecture

Zero-dependency first; swappable later for Cloud Logging.

```
src/lib/logger.ts                     // client
functions/src/utils/logger.ts         // server (wraps console + redaction)
```

API:

```ts
logger.debug(msg, meta?)
logger.info(msg, meta?)
logger.warn(msg, meta?)
logger.error(msg, meta?)
```

Structured metadata example:

```ts
logger.error("Inventory movement failed", {
  operation: "inventory.move",
  correlationId,
  userId,
  productId,
  locationId,
  errorCode,
});
```

Server implementation notes:
- Serialize `meta` with a redaction walker before writing.
- In production, emit a single JSON line per event; keep `console.error` only for raw fallback when serialization itself fails.
- Severity mapping to Cloud Logging: info/debug → `INFO`/`DEBUG`, warn → `WARNING`, error/critical → `ERROR`/`CRITICAL`.

### Redaction rules (shared constant list)

- Keys: `password`, `newPassword`, `token`, `idToken`, `refreshToken`, `authorization`, `cookie`, `apiKey`, `secret`, `privateKey`, `accessToken`, `sessionToken`, `claims`, `customData`.
- PHI string patterns: email, phone/SSN/insurance ID patterns, MRN, full names in known patient fields, `aiPrompt`, `aiResponse`, `note`/`notes`/`comment`/`description`/`summary`/`rawText`/`previewText`.
- Redact value regexes over string fields as a second pass (e.g., `\b[\w.+-]+@[\w-]+\.[\w.]+\b`).

---

## 11. Correlation ID Strategy

Smallest practical implementation that covers the audit's requirement:

- **Client:** generate `crypto.randomUUID()` once per user-invoked operation and pass it as `correlationId` in `httpsCallable` payloads and server-action/API call bodies. The generic wrapper (`callFunction`) generates it when none is supplied.
- **Server:** read `correlationId` from the request payload; fall back to `X-Cloud-Trace-Context` header (auto-attached by Cloud Functions / Cloud Run) for the `traceId`; log it in every structured log line for that invocation; persist it on `inventoryTransactions`, `auditLogs`, and `inventoryOperations` (the movement domain already writes `correlationId` to `inventoryTransactions` — reuse that field).
- **UI:** surface the correlation id in the error toast/details in admin mode only (so a support ticket can carry it).
- **Do not build:** distributed tracing SDK, span exporters, OTEL collectors, or a tracing UI. A single string plus Cloud Logging filters is sufficient for this application's size.

Expected outcome: an operation can be traced UI → hook → callable/server action → service → repository → Firestore, and each log line and document write carries the same id.

---

## 12. Health Endpoint Recommendation

Add a single, dependency-free route:

```
src/app/api/health/route.ts   →  GET /api/health
```

Response shape (no secrets, no env, no paths, no credentials):

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "buildTime": "…only when NEXT_PUBLIC_BUILD_TIME is set…",
  "uptime": 123456,
  "timestamp": "2026-…",
  "services": {
    "application": "healthy",
    "firebase": "healthy"
  }
}
```

Implementation constraints:
- `firebase` check = admin SDK lightweight read (e.g., `db.collection("health").doc("probe").get()` guarded to never write) with a 3–5 s timeout. Cache result for ~30 s to avoid hot-probing.
- Never include `NEXT_PUBLIC_FIREBASE_*`, project config, hostnames, or filesystem paths.
- Work in emulators too (respect `FIRESTORE_EMULATOR_HOST`).

Integration with AHM PowerShell tooling:
- Extend `scripts/toolkit/health-check.ps1` (and optionally `Get-ProjectHealth.ps1`) with an optional runtime probe step: `Invoke-RestMethod http://localhost:3000/api/health` when `-ProbeRuntime` is passed; parse `services.firebase` and `status`, and map failures to check-failure/critical-fail exactly like the existing exit-code discipline (0 = all critical passed).

---

## 13. Admin Diagnostics Recommendation

**Do not implement now.** Recommendation for a later stage (Phase 8 in the plan):

- New admin-only route `src/app/(admin)/system-health/page.tsx` guarded by existing `AuthGuard` / `require-admin` role checks.
- Cards: application (uptime/version/build), Firebase connectivity probe, Cloud Function last-known availability (from recent `auditLogs` + `functions` errors), recent application errors (from an `appErrors` collection written by the server logger for `error`/`critical` events; never write PHI), health-check status (render a sanitized output of the PowerShell health check), deployment version.
- Data fetched via a new admin-only callable `getSystemDiagnostics` that aggregates counts (not contents) of recent errors — do not ship raw logs to the browser.
- No new framework needed; `src/app/(admin)/settings` (InfoCard grid pattern) is the closest existing UI pattern to reuse.

---

## 14. Migration Strategy

1. Add the shared `AppError` model + `logger` module with redaction (Stage 1–2).
2. Convert the **one critical leak** first (`src/lib/adminUsers.ts`) — highest ROI, lowest risk (pure redaction change).
3. Convert transport boundaries to the error envelope, starting with `createDashboardUser` family and inventory movement callables, then remaining callables/server actions/API routes in dependency order (Stages 3–5).
4. Thread `correlationId` end-to-end (Stage 6).
5. Add `/api/health` + PowerShell probe (Stage 7).
6. Add admin diagnostics page (Stage 8).
7. Sweep-remove/convert remaining `console.*` (Stage 9) using `scripts/_scan_console.cjs` as the verification tool (target: 0 raw calls in `src/functions`, allowance: none in runtime paths, script files may keep limited verbosity).
8. Never weaken Firestore rules or client guards to "match" a logging change; every diagnostic capability must be additive.

Migration rule per PR: **one stage, one boundary, green validation gates, rollback = revert the commit** (each stage is independent and small).

---

## 15. Files Likely To Change

**New files**
- `src/lib/errors/appError.ts`
- `src/lib/errors/errorCategories.ts`
- `src/lib/logger.ts`
- `functions/src/errors/appError.ts`
- `functions/src/utils/logger.ts`
- `src/app/api/health/route.ts`
- `src/app/(admin)/system-health/page.tsx` (Stage 8)
- `functions/src/diagnostics/getSystemDiagnostics.ts` (Stage 8)

**Modified — client**
- `src/lib/adminUsers.ts` (critical redaction first)
- `src/lib/firebase.ts`
- `src/lib/inventory.ts`, `src/lib/inventory/smartMergeInventory.ts`
- `src/lib/firestoreWriteQueue.ts`, `src/lib/firestoreSafeActions.ts`
- `src/repositories/firestore/inventory.repository.ts`
- `src/app/hooks/useAuthRole.ts`, `src/app/hooks/useSingleFlight.ts`
- `src/app/(admin)/settings/hooks/use-settings-page.ts`
- `src/app/(admin)/settings/components/users/*`
- `src/app/(admin)/inventory/hooks/*`, `src/app/(admin)/orders/hooks/*`
- `src/app/(admin)/reports/*` (hooks/pages listed in §2)
- `src/app/api/*` routes (error envelope adoption)

**Modified — functions**
- `functions/src/index.ts` (wire logger/helpers, dispatch)
- `functions/src/adminUsers.ts`
- `functions/src/adminUserManagement.ts`
- `functions/src/inventory/movementFunctions.ts`, `movementService.ts`
- `functions/src/inventory/inventoryTransactionFunctions.ts`
- `functions/src/ai/askAdminAi.ts`, `functions/src/ai/callable/scanDatabasePhiSafety.ts`
- `functions/src/patients/*`, `functions/src/analytics/patientIndex.ts`
- `functions/src/imports/importFileFromStorage.ts`
- `functions/src/security/auditLog.ts` (enrich audit entries with `correlationId`)

**Modified — scripts**
- `scripts/toolkit/health-check.ps1` (+ runtime probe flag)
- `scripts/Get-ProjectHealth.ps1` (optional probe integration)
- `.gitignore` (add scan artifacts: `*.txt`, `nul`, `0`, `sh.cmd`, `out.txt`)

---

## 16. Risk Assessment

| Area | Current | After plan (all stages) |
|---|---|---|
| Credential/PII exposure in logs | **CRITICAL** (C1, C2) | Redacted, schema-validated |
| Error debuggability (codes, stacks, context) | HIGH | Preserved end-to-end via AppError + envelopes |
| Duplicate log noise | HIGH (4–6 lines/failure) | 1 structured line per layer max |
| Partial-failure visibility | HIGH (silent zero-scan) | Explicit WARNING severity + client-visible flag |
| Traceability (correlation) | NONE | Full chain via `correlationId` |
| Runtime health monitoring | NONE (static checks only) | `/api/health` + probe + admin page |
| Onboarding cost | LOW for a single file | MEDIUM — staged one file per PR |
| Rollback risk per stage | — | LOW — each stage revertible in isolation |

Net architectural complexity of the migration: **MEDIUM**.

---

## 17. Recommended Implementation Order

1. **Emergency guardrail (do first, outside stages):** redact the payload log in `src/lib/adminUsers.ts`; add redaction key list; add a regression test asserting no `password`/`newPassword` appears in the serialized log output.
2. **Stage 1** — shared `AppError` model + category map + transport envelope.
3. **Stage 2** — logger abstraction with redaction (client + server).
4. **Stage 3** — server/callable boundary adoption (inventory movement + user management first).
5. **Stage 4** — Firebase Functions logging wiring (`functions/src/index.ts`).
6. **Stage 5** — client error normalization (map FirebaseError/HttpsError → AppError).
7. **Stage 6** — correlation IDs end-to-end.
8. **Stage 7** — `/api/health` + PowerShell probe integration.
9. **Stage 8** — Admin System Health/Diagnostics page.
10. **Stage 9** — remove/convert remaining `console.*` (target 0 in runtime paths).

Each stage is detailed in `OBSERVABILITY_IMPLEMENTATION_PLAN.md`.

---

## 18. Critical Logging Remediation (2026-08-07)

**Original risk.** The ChatGPT GPT Actions endpoint (`src/app/api/chatgpt/route.ts`) could expose PHI/PII to the browser in three client-facing responses:

- `ask` mode upstream failure: `errorText.slice(0, 500)` from the AI function was returned to the caller — the error body may contain prompt text, patient data, or internal function details.
- `ask` mode upstream error object: `result.error.message` was echoed back verbatim — the upstream message may embed the prompt or PHI.
- Outer catch: `error.message` from a raw `Error` was returned to the caller — may contain request-body fragments, credentials inside embedded prompts, or internal paths.

The route also forwarded the full upstream error body with its HTTP status.

**Affected file.** `src/app/api/chatgpt/route.ts` (route handlers only; no Firestore rules, no deployment, no inventory behavior).

**Unsafe logging categories remediated.**
- Raw external API error bodies (up to 500 chars) forwarded to the browser.
- Upstream AI error messages forwarded verbatim.
- Raw `Error.message` values forwarded to the client.

**Remediation performed.**
- `response.ok === false` path: removed `const errorText = await response.text()` and `slice(0, 500)` echo; replaced with a fixed, generic message that preserves only the HTTP status: `` `AI function returned HTTP ${response.status}.` ``
- `result.error?.message` path: replaced verbatim echo with the fixed message `"The AI assistant encountered an error. Try again or use query mode."`
- Outer `catch`: replaced `error.message` echo with `"Invalid request or processing failure."` and re-bound as `_error` (no longer logged or forwarded).
- Rate limiting (`enforceRateLimit`) added for IP and API-key scopes before processing; the rate-limit module hashes the API-key identifier (SHA-256) and logs only policy/scope/error-name — never raw keys.

No `console.*` calls exist in this route (verified in the current source and in the diff against HEAD). The previous audit's console-log findings in this file had been remediated by prior work; the remaining defects were response-level PHI/PII exposure, fixed here.

**Remaining logging risks (unchanged, tracked elsewhere).**
- `src/lib/chatgpt-bridge/queries.ts` — exported `askAi()` returns raw upstream `errorText` in its error string; it is currently unused by this route (dead path). Must be redacted or removed before any future use (Stage 5 of the plan).
- `functions/src/ai/askAdminAi.ts`, patient/import/analytics console.error sites (§4 C2/H2) — out of scope for this remediation.
- `src/lib/adminUsers.ts` payload logging (audit C1 — plaintext password in browser console) — remains open; first item in the staged plan.
- `src/lib/chatgpt-bridge/queries.ts` returns raw `error.message` strings from `executeQuery`/`getDocument` in the response body to the bridge client. These are Firestore error messages and may include field paths or document references; they are not PHI by themselves but should be mapped to safe codes (Stage 5).

**Scaffolding disposition (re-verified).** The six audit-scaffolding files were re-created with full content during this remediation session per reviewer requirement, then each was explicitly reviewed against the criteria: needed by the approved plan? compiles? runtime behavior? exposes infrastructure? duplicate abstraction? imported anywhere? attack surface? premature? Final dispositions:

| File | Disposition | Rationale |
|---|---|---|
| `src/lib/errors/appError.ts` | **KEEP** | Stage 1 requirement (audit §9/§15). Compiles (`typecheck` EXIT 0). Inert until imported — no runtime behavior; no infra exposure; no duplicates; currently unreferenced; zero added attack surface in its present inert state. |
| `functions/src/errors/appError.ts` | **KEEP** | Same — server-side Stage 1 module. Compiles in `functions` build (EXIT 0). Inert until imported. |
| `src/lib/logger.ts` | **KEEP (REVISE applied)** | Stage 2 requirement. Revised during review: removed duplicate `export function redactMeta` (TS2323/TS2484), restructured `write()` to satisfy `no-console` (explicit warn/error branches + one scoped disable for console.log), fixed trailing newline. Lint-clean, typecheck-clean. No PHI/PII can pass the redaction walker. |
| `functions/src/utils/logger.ts` | **KEEP (REVISE applied)** | Same as client logger; identical compile/lint fixes applied and verified in `functions` build (EXIT 0). |
| `src/lib/health/firebaseProbe.ts` | **KEEP (REVISE applied)** | Stage 7 health-endpoint support. Revised: `DocumentReference.get()` accepts no options (TS2554) — replaced with a `Promise.race` 5 s timeout guard. Read-only (never writes), 30 s cache, converts failures to `healthy:false` (never throws), exposes no project config/hostnames/credentials. |
| `src/app/api/health/route.ts` | **KEEP** | Reviewer required the file to exist with full content. Reviewed for safety: response contains only non-sensitive operational metadata (status, public version string, timestamp, service booleans/latency) — no secrets, env, paths, or hostnames; `Cache-Control: no-store`. Matches audit §12 shape and constraints. No PHI possible in this response. |

No runtime migration was performed: none of these files is imported outside its own module chain (`rg` confirms only `route.ts` → `firebaseProbe.ts`), so they change no production behavior until their respective stages adopt them.

**Validation evidence (re-verified after file re-creation).**
- `npm run typecheck` — EXIT 0 (current tree, includes the six re-created files).
- `npx eslint src/lib/errors/appError.ts src/lib/logger.ts src/lib/health/firebaseProbe.ts src/app/api/health/route.ts functions/src/errors/appError.ts functions/src/utils/logger.ts` — EXIT 0 (0 errors, 0 warnings after `--fix` of trailing newlines).
- `npx eslint src/app/api/chatgpt/route.ts` — EXIT 0.
- `functions` `npm run build` — EXIT 0 (current tree; the historical 9 errors in `receiveScannedInventoryIntake.ts` were fixed by the inventory stream owner — see §19). Initial re-creation introduced two compile defects (TS2554 in the probe, TS2323/TS2484 duplicate export in both loggers); both were found and fixed by re-running the gates (evidence above).
- No PHI/PII-bearing values reach logs or client responses from `src/app/api/chatgpt/route.ts` after the change.
- Full `npm test` — not run in this session: repository-wide suite is BLOCKED by pre-existing environment noise (40+ modified/untracked files from other active change streams, root-level scan artifacts `out.txt`/`nul`/`0`/`sh.cmd`, `.codex-backups/`). Targeted gates for this change set all pass; blocked suite is not reported as PASS.

---

## 19. Functions Build Baseline (2026-08-07)

`cd functions && npm run build` exits `2` with exactly nine TypeScript errors, all in one file:

| File | Line | Error |
|---|---|---|
| `functions/src/inventory/receiveScannedInventoryIntake.ts` | 278 | TS2345 — `unknown` not assignable to `string \| undefined` |
| `functions/src/inventory/receiveScannedInventoryIntake.ts` | 279 | TS2345 — `unknown` not assignable to `string \| undefined` |
| `functions/src/inventory/receiveScannedInventoryIntake.ts` | 280 | TS2345 — `unknown` not assignable to `string \| undefined` |
| `functions/src/inventory/receiveScannedInventoryIntake.ts` | 281 | TS2345 — `unknown` not assignable to `string \| undefined` |
| `functions/src/inventory/receiveScannedInventoryIntake.ts` | 282 | TS2345 — `unknown` not assignable to `string \| undefined` |
| `functions/src/inventory/receiveScannedInventoryIntake.ts` | 285 | TS2345 — `unknown` not assignable to `string \| undefined` |
| `functions/src/inventory/receiveScannedInventoryIntake.ts` | 345 | TS2552 — `notes` not found; did you mean `note`? |
| `functions/src/inventory/receiveScannedInventoryIntake.ts` | 623 | TS2322 — `CreateMovementInput` missing required `inventoryItemId: string` |

**Classification.**
- **Not caused by this task / observability changes.** The file is untracked (`?? functions/src/inventory/receiveScannedInventoryIntake.ts` in `git status`), created by another agent's active inventory-work stream. It is not listed as a file that observability scaffolding touches, and no shared module in its import chain (types.ts, movementService.ts) was modified by this task.
- **Does it block future observability implementation?** No compile-level blocker for the staged plan (Stages 1–9) — the errors are confined to a single isolated module; the observability stages introduce new utility files, not edits to this inventory intake.
- **Owner/domain:** inventory/receive-scanned-intake feature stream (likely the same agent that produced `src/lib/inventory/receive-scanned-inventory-intake.ts` on the client side).
- **Recommendation:** leave untouched; surface in the owner's change set. Re-run `functions` build after that agent's next commit before any observability merge gate.

**Status update (fresh re-run):** `cd functions && npm run build` now exits **0**. The inventory stream owner fixed all nine errors above after the earlier failing run recorded in `functions/build_out.txt`. The current `functions/src/inventory/receiveScannedInventoryIntake.ts` (including the `notes` field and the `inventoryItemId` requirement) compiles clean from current source. The table above is historical; the current Functions build baseline is **GREEN** and blocks no future observability work.