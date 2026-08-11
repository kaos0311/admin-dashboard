# Codebase Guide — Advanced Home Medical Admin Dashboard

> **Purpose:** A map for engineers and AI agents to navigate this repository
> quickly. Read this first before making changes.

---

## Quick Facts

| Attribute | Value |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 6 |
| **UI** | React 19, Tailwind CSS v4, custom theme system |
| **Auth** | Firebase Auth (client) + NextAuth v5 beta |
| **Operational DB** | Cloud Firestore |
| **Relational DB** | PostgreSQL via Prisma 7 |
| **Server** | Firebase Cloud Functions (v7) |
| **AI** | OpenAI (Jarvis / SixthAI) |
| **Test Runner** | Vitest 4 |
| **Package Manager** | npm |
| **Node Engine (functions)** | Node 22 |

---

## Repository Layout

```
admin-dashboard/
├── src/                      # Application source
│   ├── app/                  # Next.js App Router (pages, layouts, API routes)
│   │   ├── (admin)/          # Authenticated admin pages
│   │   ├── (auth)/           # Login / forgot-password
│   │   ├── api/              # API routes
│   │   ├── components/       # Page-level components
│   │   └── hooks/            # Feature hooks
│   ├── components/           # Shared UI components (by domain)
│   ├── generated/            # Prisma generated client
│   ├── hooks/                # Shared hooks (barcode, inventory lookup)
│   ├── lib/                  # Client library (firebase, workflows, utils)
│   │   ├── ai/               # AI helpers
│   │   ├── analytics/        # Analytics utilities
│   │   ├── auth/             # Auth guards (require-user, require-api-auth, mfa)
│   │   ├── firebase/         # Firebase helpers
│   │   ├── firestore/        # Firestore helpers
│   │   ├── imports/          # Import utilities
│   │   ├── inventory/        # Inventory helpers
│   │   ├── navigation/       # Navigation config
│   │   ├── permissions/      # RBAC roles & permissions (single source of truth)
│   │   ├── reports/          # Report helpers
│   │   ├── security/         # Security helpers
│   │   ├── types/            # Shared types
│   │   ├── utils/           # Utility functions
│   │   └── validation/      # Validation helpers
│   ├── repositories/         # Data access layer
│   │   ├── firestore/        # Firestore repositories
│   │   └── postgres/        # Prisma/Postgres repositories
│   ├── server/               # Server actions/queries/services (scaffolded)
│   ├── services/             # Business logic layer (by domain)
│   ├── test-utils/           # Test setup
│   └── theme/                # Design token system
├── functions/                # Firebase Cloud Functions
│   ├── src/
│   │   ├── ai/               # AI callable functions
│   │   ├── analytics/        # Analytics functions
│   │   ├── audit/            # Audit logging
│   │   ├── auth/             # Role resolution
│   │   ├── domainWorkflows/  # Domain workflow services
│   │   ├── imports/          # Import pipeline
│   │   ├── inventory/        # Inventory movement functions
│   │   ├── maintenance/      # Database maintenance functions
│   │   ├── patientDocuments/ # Patient document processing
│   │   ├── qr/               # QR tracking
│   │   └── rolodex/          # Contact search
│   └── package.json
├── prisma/                   # Prisma schema & migrations
├── scripts/                  # Engineering automation scripts
│   └── toolkit/              # PowerShell toolkit (shared helpers)
├── docs/                     # Documentation
│   └── architecture/         # Architecture docs
├── public/                   # Static assets
├── adhoc-samples/            # Sample data files
└── prompts/                  # AI prompt templates
```

---

## Architecture Layers

The application follows a **layered architecture** (see
`docs/v2-architecture.md` and `docs/architecture/ARCHITECTURE.md` for full
details).

```
UI → Hooks → Services → Repositories → Database
```

| Layer | Location | Rules |
|---|---|---|
| **UI** | `src/app`, `src/components` | Render pages, handle interaction. No complex business rules. No direct DB deletes. |
| **Hooks** | `src/app/hooks`, `src/hooks` | Manage React state, subscribe to realtime data, call services. |
| **Services** | `src/services` | Business rules, workflow orchestration, validation. No JSX, no React imports. |
| **Repositories** | `src/repositories` | DB reads/writes (Prisma + Firestore). No UI logic, no toast. |
| **Client Lib** | `src/lib` | Firebase SDK init, client-side workflow wrappers, shared utilities. |
| **Cloud Functions** | `functions/src` | Server-side enforcement for high-risk operations. |

**Dependency direction is strictly enforced:**

- ✅ Allowed: `UI → Hooks → Services → Repositories → Database`
- ❌ Not allowed: `Repositories → Services`, `Services → UI`, `Services → React`, `Repositories → React`, DB code in page components

---

## Dual-Database Architecture

### Firestore (Operational / Realtime)

Primary operational database. Stores:
- Patient records and subcollections (documents, equipment, timeline)
- Inventory items and stock movements
- Orders and delivery tickets
- Rentals
- Import jobs, import queue, staging chunks
- Audit logs (immutable, Cloud Functions only)
- Inventory transactions (immutable, Cloud Functions only)
- AI conversations and audit logs
- Notifications, settings, analytics, dashboard preview
- CPAP supply pulls and call notes
- Hospice patients, insurance records
- Shop items, GL accounts, COGS
- Compliance: CMN queue, PAR alerts, equipment recalls
- Employee evaluations (tank-only)
- QR cards and scan events
- Rolodex contacts, PHI alerts, improvement proposals

See: `docs/architecture/FIRESTORE.md` for the full collection reference.

### PostgreSQL (Structured / Relational)

Via Prisma. Stores structured relational data:

| Model | Purpose |
|---|---|
| `Customer` | Customers with equipment relations |
| `Location` | Warehouse/service locations |
| `Manufacturer` | Equipment manufacturers |
| `EquipmentModel` | Equipment models (manufacturer → models) |
| `Equipment` | Individual equipment items with asset tags, serial numbers, status |
| `WorkOrder` | Equipment maintenance work orders |
| `AuditLog` | Postgres-side audit log |

See: `prisma/schema.prisma` for the full schema.

---

## Key Files to Know

| File | Purpose |
|---|---|
| `src/lib/firebase.ts` | Client Firebase app, App Check, Auth, Firestore, Functions, Storage |
| `src/lib/firebaseAdmin.ts` | Server-side Firebase Admin SDK |
| `src/lib/domainWorkflows.ts` | Client wrappers for all domain workflow callable functions |
| `src/lib/firestoreSafeActions.ts` | Client-side Firestore write + audit helpers |
| `src/lib/firestoreWriteQueue.ts` | Batched Firestore write queue |
| `src/lib/prisma.ts` | Prisma client singleton with Pg adapter |
| `src/lib/permissions/roles.ts` | RBAC role + permission definitions (single source of truth) |
| `src/lib/auth/require-user.ts` | Server component auth guard |
| `src/lib/auth/require-api-auth.ts` | API route auth guard (Firebase ID token verification) |
| `src/lib/auth/mfa.ts` | TOTP multi-factor auth flow |
| `functions/src/index.ts` | Cloud Functions entry point |
| `functions/src/auth/roles.ts` | Cloud Functions role resolution |
| `firestore.rules` | Firestore security rules (723 lines) |
| `storage.rules` | Cloud Storage security rules |
| `firestore.indexes.json` | Composite index definitions |

---

## npm Scripts

### Root (`package.json`)

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Start dev server |
| `build` | `next build` | Production build |
| `start` | `next start` | Start production server |
| `lint` | `eslint` | ESLint static analysis |
| `typecheck` | `tsc --noEmit` | TypeScript type-checking |
| `test` | `vitest run` | Run unit tests |
| `test:watch` | `vitest` | Run tests in watch mode |
| `test:coverage` | `vitest run --coverage` | Run tests with coverage |
| `verify` | `lint && typecheck && build` | Full verification |
| `validate:inventory-writes` | `node scripts/validate-inventory-writes.cjs` | Validate inventory write safety |
| `validate:domain-writes` | `node scripts/validate-domain-writes.cjs` | Validate domain write safety |
| `verify:imports` | `tsx scripts/verify-import-routing.ts` | Validate import routing |
| `import:par` | `tsx scripts/import-par-report.ts` | Import PAR report |
| `import:hcpcs` | `node scripts/import-hcpcs-dhs-codes.cjs` | Import HCPCS/DHS codes |
| `seed:brightree` | `tsx scripts/seedBrightreeReferences.ts` | Seed Brightree references |
| `seed:rolodex:doctors` | `tsx scripts/seedRolodexDoctors.ts` | Seed rolodex doctors |
| `seed:rolodex:facilities` | `tsx scripts/seedRolodexFacilities.ts` | Seed rolodex facilities |
| `repair:users` | `tsx scripts/repairUsers.ts` | Repair user records |
| `emulators:test` | `cd functions && npm run test:emulator` | Run emulator tests |

### Functions (`functions/package.json`)

| Script | Command | Purpose |
|---|---|---|
| `build` | `tsc` | Compile TypeScript |
| `watch` | `tsc --watch` | Watch mode |
| `lint` | `eslint --ext .js,.ts .` | ESLint |
| `serve` | `npm run build && firebase emulators:start --only functions` | Serve with emulators |
| `test` | `vitest run --config vitest.config.ts` | Unit tests |
| `test:integration` | `vitest run --config vitest.integration.config.ts` | Integration tests |
| `test:emulator` | `firebase emulators:exec --only firestore,auth "npm run test:integration"` | Emulator tests |

---

## Engineering Toolkit

PowerShell scripts for linting, type-checking, building, auditing, and verifying
repository health.

### Toolkit (`scripts/toolkit/`)

| Script | Purpose |
|---|---|
| `toolkit-common.ps1` | Shared helper module (dot-sourced by all toolkit scripts) |
| `toolkit.ps1` | Unified entry point |
| `lint.ps1` | ESLint static analysis |
| `typecheck.ps1` | TypeScript type-checking |
| `build.ps1` | Next.js production build |
| `build-functions.ps1` | Cloud Functions build |
| `audit-deps.ps1` | Dependency security audit |
| `dead-code.ps1` | Dead code detection (heuristic) |
| `health-check.ps1` | Comprehensive project health check |
| `git-status.ps1` | Git repository status report |
| `release-readiness.ps1` | Full release-readiness gate |

See: `scripts/toolkit/README.md` for full details.

### Standalone Scripts (`scripts/`)

| Script | Purpose |
|---|---|
| `Invoke-ProjectValidation.ps1` | Runs lint, typecheck, build, functions build; stops on first failure |
| `Get-ProjectHealth.ps1` | Reports environment, dependencies, config, and Git state |
| `Get-ReleaseReadiness.ps1` | Pre-release gate combining Git hygiene + validation pipeline |
| `Invoke-RepositoryAudit.ps1` | Validates repository structure, documentation, and detects issues |
| `Invoke-DocumentationValidation.ps1` | Validates Markdown formatting, links, and structure |
| `Invoke-RepositoryStatistics.ps1` | Generates repository statistics report |

See: `docs/DEVELOPMENT-VALIDATION.md` for the standalone script documentation.

---

## Cloud Functions Overview

All Cloud Functions run in `us-central1` with a global `maxInstances` of 10.

| Category | Functions |
|---|---|
| **User Management** | `createDashboardUser`, `updateUserRole`, `disableUser`, `enableUser`, `deleteUser`, `resetPassword` |
| **AI** | `askAdminAi`, `scanDatabasePhiSafety`, `screenImportJobWithJarvis` |
| **Import Pipeline** | `importFileFromStorage` (trigger), `processImportWorkerQueue`, `scheduledImportCleanup`, `reprocessImportJobFromFirestore` |
| **Inventory** | `lookupByBarcode`, `receiveByBarcode`, `issue`, `cycleCount`, `transfer`, `createMovement`, `reverseMovement`, `reconcile` |
| **Domain Workflows** | `deliveryScans`, `deliveryCompletion`, `signatures`, `damagePhotos`, `techCheckIn`, `routeUpdate`, `rentalCheckout/Return/Exchange/Cancel`, `patientEquipment`, `patientLifecycle`, `cleanupPendingUploads` |
| **Maintenance** | `cleanDatabase`, `rebuildEverything`, `rebuildReportsAnalytics`, `reprocessImportJob`, `softResetReports`, `resetOperationalDatabase` |
| **Bootstrap** | `bootstrapAdminClaim` |
| **Patient Documents** | `processPatientDocumentFromStorage` |
| **QR Tracking** | `trackQrScan` |
| **Rolodex** | `searchRolodexContacts` |

---

## RBAC Roles

| Role | Description | Firestore Access |
|---|---|---|
| `admin` | Full access | Yes |
| `tank` | Super-admin (employee evaluations) | Yes (treated as admin) |
| `staff` | Standard operational access | Yes |
| `manager` | Management access (app-level only) | No |
| `technician` | Field technician (app-level only) | No |
| `billing` | Billing access (app-level only) | No |
| `read-only` | Read-only access (app-level only) | No |

> **Note:** Firestore rules only recognize `admin`, `tank`, and `staff`. Other
> roles are app-level only (see `src/lib/permissions/roles.ts`).

---

## Related Documentation

| Document | Purpose |
|---|---|
| `docs/v2-architecture.md` | Architecture overview and layer rules |
| `docs/architecture/ARCHITECTURE.md` | Detailed architecture with diagrams |
| `docs/architecture/FIRESTORE.md` | Firestore collections, rules, and indexes |
| `docs/architecture/TESTING.md` | Testing strategy and configuration |
| `docs/architecture/AUTHENTICATION.md` | Authentication architecture |
| `docs/architecture/DEPLOYMENT.md` | Deployment guide |
| `docs/architecture/DEVELOPMENT.md` | Development setup |
| `docs/architecture/DOMAIN-WORKFLOWS.md` | Domain workflow documentation |
| `docs/architecture/PROJECT.md` | Project overview |
| `docs/DEVELOPMENT-VALIDATION.md` | Validation toolkit documentation |
| `PRODUCTION_READINESS.md` | Production readiness audit |