# Project Overview — Advanced Home Medical Admin Dashboard

## What This Project Is

The **Advanced Home Medical (AHM) Admin Dashboard** is a Next.js 16 operations
platform for a Durable Medical Equipment (DME) company. It manages the full
operational lifecycle: patients, orders, inventory, rentals, deliveries,
insurance, hospice care, CPAP compliance, retail/shop data, employee
evaluations, and an AI-powered administrative assistant ("Jarvis").

The application uses a **dual-database architecture**:

- **Firestore** — realtime operational data, audit logs, import jobs,
  notifications, domain workflow state, and AI conversation history.
- **PostgreSQL (via Prisma)** — structured relational data for equipment,
  equipment models, customers, locations, manufacturers, work orders, and
  Postgres-side audit logs.

Firebase Cloud Functions handle all high-risk server-side operations:
inventory movements, domain workflow transitions, user management, the import
pipeline, and AI processing.

## Firebase Project

| Property | Value |
|---|---|
| Project ID | `advanced-home-medical-55772` |
| Auth domain | `advanced-home-medical-55772.firebaseapp.com` |
| Storage bucket | `advanced-home-medical-55772.firebasestorage.app` |
| Cloud Functions region | `us-central1` |
| Config file | `.firebaserc` |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 16.2.3 (App Router) |
| UI library | React 19.2.4 |
| Styling | Tailwind CSS v4 + custom theme token system |
| State / data | React hooks + Firebase SDK (client-side Firestore) |
| Backend | Firebase Cloud Functions v2 (Node.js 22) |
| Auth | Firebase Authentication (email/password + custom claims) |
| App protection | Firebase App Check (reCAPTCHA Enterprise) |
| Operational database | Cloud Firestore |
| Relational database | PostgreSQL via Prisma 7.8 (`@prisma/adapter-pg`) |
| AI | OpenAI API (GPT-4.1-mini) via Cloud Functions |
| Barcode scanning | `@zxing/browser`, `@ericblade/quagga2`, `html5-qrcode` |
| CSV parsing | PapaParse |
| PDF parsing | `pdfjs-dist` (client), `pdf-parse` (functions) |
| Validation | Zod 4 |
| Testing | Vitest 4 |
| Linting | ESLint 9 + `eslint-config-next` |
| Build target | ES2017 (app), ES2022 (functions) |

## Repository Structure (Major Directories)

```
admin-dashboard/
├── src/                    # Next.js application source
│   ├── app/                # App Router pages, API routes, layouts
│   │   ├── (admin)/        # Authenticated admin route group
│   │   ├── (auth)/         # Login / forgot-password routes
│   │   ├── api/            # Next.js API routes (chatgpt, equipment, etc.)
│   │   ├── components/     # App-level components (sidebar, auth guards)
│   │   └── hooks/          # App-level hooks (useAuthRole, useAppSettings)
│   ├── components/         # Shared UI components (ui/, charts/, scanning/)
│   ├── generated/          # Prisma generated client
│   ├── hooks/              # Shared hooks (useBarcodeScanner, useInventoryLookup)
│   ├── lib/                # Core libraries (firebase, auth, permissions, workflows)
│   │   ├── ai/             # Client-side AI helpers
│   │   ├── auth/           # Auth guards (require-user, require-api-auth, mfa)
│   │   ├── chatgpt-bridge/ # ChatGPT integration bridge
│   │   ├── commandCenter/  # Compliance issue building
│   │   ├── firebase/       # Firebase client helpers
│   │   ├── firestore/      # Firestore query helpers by domain
│   │   ├── imports/        # Client-side import helpers
│   │   ├── inventory/      # Inventory client helpers
│   │   ├── navigation/     # Navigation config
│   │   ├── permissions/    # RBAC roles + permissions
│   │   ├── reports/        # Report helpers
│   │   ├── security/       # Security utilities
│   │   ├── types/          # Shared TypeScript types
│   │   ├── utils/          # General utilities
│   │   └── validation/     # Validation helpers
│   ├── repositories/       # Data access layer
│   │   ├── firestore/      # Firestore repositories (inventory, order, product)
│   │   └── postgres/       # Prisma repositories (equipment, customer, etc.)
│   ├── server/            # Server actions / queries / services (scaffolded)
│   ├── services/           # Business logic services by domain
│   ├── test-utils/         # Test setup
│   └── theme/              # Design token system (colors, spacing, typography)
├── functions/              # Firebase Cloud Functions
│   └── src/
│       ├── ai/             # AI callables + PHI safety + prompts + tools
│       ├── analytics/      # Patient index analytics
│       ├── audit/          # Audit logging
│       ├── auth/           # Role resolution for callable functions
│       ├── domainWorkflows/# Server-side domain workflow services + callables
│       ├── imports/        # Import pipeline (engine, queues, staging, workers)
│       ├── inventory/      # Inventory movement + transaction services
│       ├── maintenance/   # Database rebuild / cleanup tools
│       ├── patientDocuments/ # Patient document processing
│       ├── qr/             # QR scan tracking
│       ├── rolodex/        # Contact search
│       └── test-utils/     # Emulator-based integration tests
├── prisma/                 # Prisma schema + migrations
├── scripts/                # Validation, seeding, and maintenance scripts
├── docs/                   # Project documentation
├── public/                 # Static assets
├── adhoc-samples/          # Sample data files (CSV, PDF, JSON)
└── prompts/                # AI prompt templates
```

## Key Configuration Files

| File | Purpose |
|---|---|
| `firebase.json` | Firebase deployment config (functions, firestore rules, storage rules) |
| `.firebaserc` | Firebase project ID mapping |
| `firestore.rules` | Firestore security rules (723 lines) |
| `firestore.indexes.json` | Composite index definitions |
| `storage.rules` | Cloud Storage security rules |
| `next.config.ts` | Next.js configuration (server actions, external packages) |
| `tsconfig.json` | TypeScript config for the app (excludes `scripts/` and `functions/`) |
| `functions/tsconfig.json` | TypeScript config for Cloud Functions |
| `vitest.config.ts` | Vitest config for the app |
| `functions/vitest.config.ts` | Vitest config for functions unit tests |
| `functions/vitest.integration.config.ts` | Vitest config for emulator integration tests |
| `eslint.config.mjs` | ESLint configuration |
| `prisma/schema.prisma` | Prisma schema (PostgreSQL models) |
| `prisma.config.ts` | Prisma configuration |

## npm Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Start development server |
| `build` | `next build` | Production build |
| `start` | `next start` | Start production server |
| `lint` | `eslint` | Run ESLint |
| `typecheck` | `tsc --noEmit` | TypeScript type checking |
| `test` | `vitest run` | Run unit tests |
| `test:watch` | `vitest` | Run tests in watch mode |
| `test:coverage` | `vitest run --coverage` | Run tests with coverage |
| `verify` | `lint && typecheck && build` | Full validation pipeline |
| `validate:inventory-writes` | `node scripts/validate-inventory-writes.cjs` | Static analysis: no direct inventory writes outside movementService |
| `validate:domain-writes` | `node scripts/validate-domain-writes.cjs` | Static analysis: no direct domain workflow writes outside workflow services |
| `verify:imports` | `tsx scripts/verify-import-routing.ts` | Verify import routing configuration |
| `import:par` | `tsx scripts/import-par-report.ts` | Import PAR report |
| `import:hcpcs` | `node scripts/import-hcpcs-dhs-codes.cjs` | Import HCPCS/DHS codes |
| `seed:brightree` | `tsx scripts/seedBrightreeReferences.ts` | Seed Brightree reference data |
| `seed:rolodex:doctors` | `tsx scripts/seedRolodexDoctors.ts` | Seed rolodex doctors |
| `seed:rolodex:facilities` | `tsx scripts/seedRolodexFacilities.ts` | Seed rolodex facilities |
| `repair:users` | `tsx scripts/repairUsers.ts` | Repair user accounts |
| `emulators:test` | `cd functions && npm run test:emulator` | Run emulator-based integration tests |

## Domain Areas

The dashboard manages these operational domains:

1. **Patients** — patient profiles, lifecycle (active → archived → destroyed),
   equipment assignments, timeline, documents, physicians, referrals
2. **Inventory** — products, stock levels, barcodes, serial numbers, lot
   tracking, stock movements, warehouse transfers, cycle counts
3. **Orders** — sales orders, delivery tickets, hospice orders
4. **Rentals** — rental checkout, returns, exchanges, cancellations
5. **Deliveries** — delivery ticket fulfillment, load/deliver/return scanning,
   signatures, damage photos, tech check-ins, route management
6. **Insurance** — insurance records, patient authorizations, insurance queue
7. **Hospice** — hospice patient oversight, nurse assignments
8. **CPAP** — supply pulls, call notes, setup appointments
9. **Imports** — CSV report ingestion, report type detection, staging, queue
   processing, retention windows
10. **Retail/Shop** — shop items, inventory lots, serials, GL accounts, COGS,
    raw reports
11. **Compliance** — CMN queue, PAR alerts, equipment recalls, recall matches
12. **AI (Jarvis)** — admin AI assistant with PHI safety scanning, web search,
    operational context building, CSV report generation
13. **Employee Evaluations** — evaluation forms, comments, snapshots (tank-only)
14. **Audit** — Firestore audit logs (immutable, Cloud Functions only)
15. **QR Codes** — QR card tracking and scan events
16. **Rolodex** — contact directory search
17. **Work Orders** — equipment maintenance work orders (Postgres)
18. **Notifications** — user notification system

## Current State

The project is under active development. A production readiness audit
(`PRODUCTION_READINESS.md`) identified critical security, testing, and
architecture gaps that are being addressed. The codebase has a documented
v2 architecture (`docs/v2-architecture.md`) that defines the target layer
separation, and validation scripts enforce that protected fields are only
written from authorized service files.