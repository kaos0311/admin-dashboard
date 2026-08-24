# Testing

## Overview

The AHM Admin Dashboard uses **Vitest 4** as its test runner for both the
Next.js application and Firebase Cloud Functions. The testing strategy
includes unit tests, integration tests, and emulator-based tests.

## Test Configuration

### Application Tests

**File:** `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["src/test-utils/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", "**/node_modules/**", "functions", "scripts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/permissions/roles.ts"],
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

**Key points:**
- Environment: `node` (not jsdom)
- Globals enabled (no need to import `describe`, `it`, `expect`)
- Setup file: `src/test-utils/setup.ts`
- Path alias: `@` → `src/`
- Coverage: V8 provider, currently scoped to `src/lib/permissions/roles.ts`
- Excludes: `functions/` and `scripts/`

### Cloud Functions Unit Tests

**File:** `functions/vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    exclude: ["lib", "node_modules", "src/**/*.emulator.test.ts"],
  },
});
```

**Key points:**
- Environment: `node`
- Globals enabled
- Includes: `src/**/*.test.ts`
- Excludes: compiled `lib/`, emulator tests

### Cloud Functions Integration Tests

**File:** `functions/vitest.integration.config.ts`

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/test-utils/**/*.integration.test.ts",
      "src/test-utils/**/*.emulator.test.ts"
    ],
    exclude: ["node_modules", "lib"],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      FIRESTORE_EMULATOR_HOST: "localhost:8080",
      FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099",
      GCLOUD_PROJECT: "advanced-home-medical-55772",
    },
  },
});
```

**Key points:**
- Extended timeouts (30s for tests and hooks)
- Emulator environment variables pre-configured
- Only runs integration and emulator test files
- Requires Firebase emulators running

## Test Commands

### Application Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Cloud Functions Tests

```bash
# Unit tests (from functions directory)
cd functions && npm test

# Integration tests (requires emulators)
cd functions && npm run test:integration

# Emulator-based tests (starts emulators automatically)
npm run emulators:test
# Equivalent to: cd functions && firebase emulators:exec --project demo-advanced-home-medical --only firestore,auth "npm run test:integration"
```

## Test Files

### Application Test Files

| Test File | What It Tests |
|---|---|
| `src/lib/__tests__/barcode-safety.test.ts` | Barcode safety validation |
| `src/lib/__tests__/barcode.test.ts` | Barcode parsing/normalization |
| `src/lib/__tests__/domain-protected-fields.test.ts` | Runtime guard for protected rental and patient-equipment fields |
| `src/lib/__tests__/domain-write-validation.test.ts` | Domain write protection validation |
| `src/lib/__tests__/inventory-lookup.test.ts` | Inventory lookup by barcode |
| `src/lib/__tests__/inventory-write-validation.test.ts` | Inventory write protection validation |
| `src/lib/__tests__/receive-inventory-client.test.ts` | Client-side receive inventory |
| `src/lib/__tests__/receive-inventory.test.ts` | Receive inventory flow |
| `src/lib/permissions/roles.test.ts` | RBAC role and permission logic |
| `src/lib/auth/require-api-auth.test.ts` | API auth guard |
| `src/app/api/improvements/route.e2e.test.ts` | Improvements API route (E2E) |

### Cloud Functions Test Files

| Test File | What It Tests |
|---|---|
| `functions/src/domainWorkflows/stateMachines.test.ts` | Domain workflow state machine transitions |
| `functions/src/inventory/movementService.test.ts` | Inventory movement service logic |
| `functions/src/test-utils/emulator-setup.ts` | Emulator test setup utilities |
| `functions/src/test-utils/receive-inventory.emulator.test.ts` | Receive inventory via emulator |

## Test Setup

### Application Test Setup

**File:** `src/test-utils/setup.ts`

This file is loaded before all application tests. It provides test
environment configuration.

### Emulator Test Setup

**File:** `functions/src/test-utils/emulator-setup.ts`

Provides utilities for setting up emulator-based tests:

- Firestore emulator connection
- Auth emulator connection
- Credential-free Firebase Admin initialization
- Localhost-only emulator host validation
- Isolated `demo-*` project ID validation
- Repository-local service-account detection
- Cleanup helpers

Emulator tests must not use real Firebase credentials. Do not set
`GOOGLE_APPLICATION_CREDENTIALS` or Firebase service-account environment
variables when running `npm run emulators:test`. A root
`serviceAccountKey.json` file intentionally blocks the suite.

## Firebase Rules Unit Testing

The project includes `@firebase/rules-unit-testing` (v5.0.0) as a
devDependency. This allows testing Firestore security rules in isolation.

```typescript
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";

const testEnv = await initializeTestEnvironment({
  projectId: "advanced-home-medical-55772",
  firestore: { rules: readFileSync("firestore.rules", "utf8") },
});

// Test that staff can read inventory
await assertSucceeds(
  testEnv.authenticatedContext("user-uid", { role: "staff" })
    .firestore()
    .collection("inventory")
    .get()
);

// Test that unauthenticated users cannot read
await assertFails(
  testEnv.unauthenticatedContext()
    .firestore()
    .collection("inventory")
    .get()
);
```

## Protected Workflow Smoke Tests

Before deployment, run the automated checks and then manually verify:

1. Creating a non-checkout rental from the Rentals page creates a `draft`
   document without patient, inventory, return, cancellation, or movement
   linkage fields.
2. Creating a checked-out rental calls `createAndCheckoutRentalWorkflowCallable`
   and creates the rental, inventory movement, patient equipment assignment,
   timeline entry, idempotency record, and audit log together.
3. Returning, exchanging, and cancelling a rental call the rental workflow
   callables and do not perform client-side protected field writes.
4. Patient equipment assign/remove/transfer/replace/lost/damaged/return actions
   call `patientEquipmentWorkflowCallable` and update equipment, movement,
   timeline, idempotency, and audit state together.

## Test Coverage

### Current Coverage Configuration

Coverage is configured with the V8 provider and currently scoped to:

```
src/lib/permissions/roles.ts
```

This is a minimal coverage target. The coverage configuration should be
expanded as the test suite grows.

### Coverage Reporters

| Reporter | Output |
|---|---|
| `text` | Console output |
| `lcov` | `coverage/lcov.info` |
| `html` | `coverage/index.html` |

## Testing Best Practices

### Unit Tests

- Test files should be co-located with source in `__tests__/` directories
- File naming: `*.test.ts` or `*.test.tsx`
- Use Vitest globals (`describe`, `it`, `expect`) — no imports needed
- Test one unit of behavior per test case

### Integration Tests

- File naming: `*.integration.test.ts`
- Require running Firebase emulators
- Use extended timeouts (30s configured)
- Clean up test data between tests

### Emulator Tests

- File naming: `*.emulator.test.ts`
- Run via `firebase emulators:exec`
- Test against real Firestore/Auth emulators
- Use `functions/src/test-utils/emulator-setup.ts` for setup

## Test Dependencies

### Application

| Package | Version | Purpose |
|---|---|---|
| `vitest` | ^4.1.4 | Test runner |
| `@vitest/coverage-v8` | ^4.1.10 | Coverage provider |
| `@firebase/rules-unit-testing` | ^5.0.0 | Firestore rules testing |
| `firebase` | ^12.16.0 | Firebase SDK for test integration |

### Cloud Functions

| Package | Version | Purpose |
|---|---|---|
| `vitest` | ^4.1.10 | Test runner |
| `firebase-functions-test` | ^3.4.1 | Cloud Functions test helpers |

## Known Testing Gaps

Based on `PRODUCTION_READINESS.md`:

1. **Low test coverage** — the test suite is growing but many critical paths
   lack tests
2. **No E2E tests** — no Playwright or Cypress E2E test suite
3. **Coverage scoped to one file** — `vitest.config.ts` coverage only
   includes `src/lib/permissions/roles.ts`
4. **No CI/CD test pipeline** — tests must be run manually
5. **No load testing** — no performance or load testing configured

## Validation as Testing

In addition to Vitest tests, the project uses static analysis scripts as
a form of architectural testing:

| Script | What It Validates |
|---|---|
| `validate:inventory-writes` | No direct inventory writes outside movementService |
| `validate:domain-writes` | No direct domain workflow writes outside workflow services |
| `verify:imports` | Import routing configuration is valid |
| `verify` (npm script) | lint + typecheck + build passes |

These scripts run as part of the development workflow and release
readiness gate.
