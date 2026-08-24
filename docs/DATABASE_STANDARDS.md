# Database Standards — Advanced Home Medical Admin Dashboard

> **Purpose:** Standards for database access, schema management, and data
> integrity across both PostgreSQL (Prisma) and Cloud Firestore.

---

## Dual-Database Architecture

| Database | Role | Access Layer |
|---|---|---|
| **PostgreSQL** (via Prisma) | Structured/relational data | src/repositories/postgres/ |
| **Cloud Firestore** | Operational/realtime data | src/repositories/firestore/ + Cloud Functions |

See docs/architecture/ARCHITECTURE.md for the full architecture.

---

## PostgreSQL Standards (Prisma)

### Schema Management

- Schema file: prisma/schema.prisma
- Generated client: src/generated/prisma/
- Singleton: src/lib/prisma.ts
- Migrations: prisma/migrations/

### Rules

1. Never use raw SQL without parameterized queries.
2. Always use the Prisma client singleton (src/lib/prisma.ts).
3. All schema changes require a migration (npx prisma migrate dev).
4. Never commit serviceAccountKey.json or connection strings.
5. Add indexes for frequently queried fields.
6. Use @updatedAt on all models that have an update path.
7. Use @unique constraints for fields that should be unique.
8. Define foreign key relations explicitly with @relation.

### Prisma Models

| Model | Purpose | Key Fields |
|---|---|---|
| Customer | Customers with equipment relations | name (unique), phone, email |
| Location | Warehouse/service locations | name (unique), address |
| Manufacturer | Equipment manufacturers | name (unique) |
| EquipmentModel | Equipment models | name, category, manufacturerId |
| Equipment | Individual equipment items | assetTag (unique), serialNumber (unique), status |
| WorkOrder | Equipment maintenance work orders | equipmentId, status, issue |
| AuditLog | Postgres-side audit log | userId, action, entityType, createdAt |

### Enums

| Enum | Values |
|---|---|
| EquipmentStatus | AVAILABLE, IN_USE, NEEDS_REPAIR, IN_REPAIR, RETIRED, LOST |
| WorkOrderStatus | OPEN, IN_PROGRESS, COMPLETED, CANCELLED |

### Migration Workflow

- npx prisma migrate dev --name <descriptive-name>
- npx prisma generate
- npx prisma migrate deploy

### Known Issues

- Only one migration exists (20260701133541_init_inventory_schema)
- No indexes on AuditLog (userId, action, createdAt)
- No cascade deletes defined
- AuditLog.userId is a loose string reference (no foreign key)
- Pool created at import time in prisma.ts (not lazy)

---

## Firestore Standards

See docs/FIRESTORE_STANDARDS.md for the full Firestore standards.

### Key Rules

1. All collections must have security rules in firestore.rules.
2. High-risk collections are immutable (auditLogs, inventoryTransactions).
3. Protected fields cannot be modified by client-side writes.
4. Use writeBatch for multi-document updates.
5. Use runTransaction for atomic read-modify-write operations.
6. Never use set() with merge: true on protected fields.
7. Composite indexes defined in firestore.indexes.json.

---

## Data Access Layer Rules

### Repository Pattern

All database access goes through repositories in src/repositories/:

| Repository | Database | Path |
|---|---|---|
| Inventory | Firestore | src/repositories/firestore/inventory.repository.ts |
| Order | Firestore | src/repositories/firestore/order.repository.ts |
| Product | Firestore | src/repositories/firestore/product.repository.ts |
| Audit Log | Postgres | src/repositories/postgres/audit-log.repository.ts |
| Customer | Postgres | src/repositories/postgres/customer.repository.ts |
| Equipment | Postgres | src/repositories/postgres/equipment.repository.ts |
| Equipment Model | Postgres | src/repositories/postgres/equipment-model.repository.ts |
| Location | Postgres | src/repositories/postgres/location.repository.ts |
| Manufacturer | Postgres | src/repositories/postgres/manufacturer.repository.ts |
| Work Order | Postgres | src/repositories/postgres/work-order.repository.ts |

### Rules

- No UI logic in repositories (no toast, no React state, no JSX).
- No business rules in repositories (data access only).
- Services call repositories (never the DB directly).
- Repositories return typed data (never any).
- Repositories handle errors (throw typed errors, not raw DB errors).

---

## Transaction Standards

### Firestore Transactions

Use runTransaction for atomic read-modify-write operations. Never read a
document, modify it in memory, and write it back without a transaction.
Concurrent requests will cause race conditions.

### Prisma Transactions

Use  for multi-operation atomicity.

---

## Backup and Recovery

### Firestore

- No automated backups currently configured (known gap).
- Recommended: Set up scheduled exports to Cloud Storage.

### PostgreSQL

- Backup: pg_dump or managed backup service.
- Restore: Test restore procedures regularly.

---

## Data Retention

- Import jobs and staging chunks are cleaned up by scheduledImportCleanup.
- importRetention.ts manages retention policies.
- Audit logs are immutable and retained indefinitely.
- Inventory transactions are immutable and retained indefinitely.
