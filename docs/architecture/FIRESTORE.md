# Firestore — Collections, Rules, and Indexes

## Overview

Cloud Firestore is the primary operational database for the AHM Admin
Dashboard. It stores realtime operational data, audit logs, import jobs,
domain workflow state, and AI conversation history. Security rules enforce
role-based access control (RBAC) with protected field validation for
high-risk collections.

## Security Rules Architecture

The security rules (`firestore.rules`, 723 lines) implement a layered
authorization model:

```mermaid
graph TD
    Request["Client Request"] --> IsSignedIn{isSignedIn?}
    IsSignedIn -->|No| Deny["Deny"]
    IsSignedIn -->|Yes| ClaimRole["claimRole()<br/>from custom token"]
    ClaimRole --> HasProfile{hasProfile?<br/>users/{uid} exists}
    HasProfile -->|Yes| ProfileRole["profileRole()<br/>from users doc"]
    HasProfile -->|No| TokenOnly["Use token role only"]
    ProfileRole --> IsActive{isActiveProfile?<br/>not disabled/deleted}
    TokenOnly --> IsActive
    IsActive -->|No| Deny
    IsActive -->|Yes| Role["role()<br/>claim or profile"]
    Role --> HasRole{hasRole(expected)?}
    HasRole -->|Yes| Allow["Allow"]
    HasRole -->|No| Deny
```

### Role Resolution

The `role()` function resolves the user's role with this priority:

1. **Custom claim role** (`request.auth.token.role`) — set by Cloud Functions
2. **Profile role** (`users/{uid}.role`) — from the Firestore user document
3. Falls back to empty string if neither exists

### Role Hierarchy

| Role | Description | Admin? | Staff? |
|---|---|---|---|
| `admin` | Full access | Yes | — |
| `tank` | Super-admin (employee evaluations) | Yes | — |
| `staff` | Standard operational access | No | Yes |
| `manager` | Management access (app-level only) | No | No |
| `technician` | Field technician (app-level only) | No | No |
| `billing` | Billing access (app-level only) | No | No |
| `read-only` | Read-only access (app-level only) | No | No |

> **Note:** Firestore rules only recognize `admin`, `tank`, and `staff` for
> access control. The `manager`, `technician`, `billing`, and `read-only`
> roles are defined in the app-level RBAC (`src/lib/permissions/roles.ts`)
> but are not granted Firestore access by the rules.

### Key Helper Functions

| Function | Purpose |
|---|---|
| `isSignedIn()` | Checks `request.auth != null` |
| `claimRole()` | Reads role from auth token |
| `profileRole()` | Reads role from `users/{uid}` document |
| `isActiveProfile()` | Checks user is not disabled/deleted/inactive |
| `role()` | Resolves role (claim → profile) |
| `isAdmin()` | `role == "admin" \|\| role == "tank"` |
| `isStaff()` | `role == "staff"` |
| `isStaffOrAdmin()` | `isAdmin() \|\| isStaff() \|\| isTank()` |
| `isSelf(userId)` | `request.auth.uid == userId` |

## Collections

### Core Operational Collections

| Collection | Read | Write | Delete | Notes |
|---|---|---|---|---|
| `users` | self or admin | admin (self: safe fields only) | admin | User profiles with role, active, disabled |
| `settings` | staff+ | admin | admin | Application settings |
| `analytics` | staff+ | admin | admin | Dashboard analytics, retail financials |
| `patientIndex` | staff+ | admin | admin | Patient search index |
| `apiRegistry` | staff+ | admin | admin | API integration registry |
| `vendorResearchSites` | staff+ | admin | admin | Vendor research links |
| `dashboardPreview` | staff+ | admin | admin | Dashboard preview data |

### Patient Collections

| Collection | Read | Write | Delete | Notes |
|---|---|---|---|---|
| `patients` | staff+ | staff+ (create), staff+ (update, protected fields) | never | Protected lifecycle fields |
| `patients/{id}/documents` | staff+ | staff+ | admin | Patient documents |
| `patients/{id}/equipment` | staff+ | staff+ (metadata only; no protected equipment fields) | admin | Protected equipment fields |
| `patients/{id}/timeline` | staff+ | staff+ (not system-generated) | admin | Patient timeline events |
| `patients_index` | staff+ | staff+ | staff+ | Patient index (alternate) |
| `hospicePatients` | staff+ | staff+ | staff+ | Hospice patient records |
| `patientPhysicians` | staff+ | admin | admin | Patient physician records |
| `patientReferrals` | staff+ | admin | admin | Patient referral records |
| `patientAuthorizations` | staff+ | admin | admin | Patient authorizations |

### Inventory Collections

| Collection | Read | Write | Delete | Notes |
|---|---|---|---|---|
| `inventory` | staff+ | staff+ (create: safe defaults, update: no protected fields) | never | Protected stock fields |
| `products` | staff+ | staff+ (no stock field changes) | admin | Product catalog |
| `stockMovements` | staff+ | never (Functions only) | never | Stock movement log |
| `inventoryOperations` | staff+ | never (Functions only) | never | Idempotency records |
| `inventoryTransactions` | staff+ | never (Functions only) | never | Immutable transaction log |

### Order & Rental Collections

| Collection | Read | Write | Delete | Notes |
|---|---|---|---|---|
| `orders` | staff+ | staff+ | staff+ | Sales orders |
| `rentals` | staff+ | staff+ (create: draft metadata only; update: no protected fields) | never | Protected rental workflow fields |
| `patientDeliveryTickets` | staff+ | staff+ (create, update: protected fields) | admin | Protected delivery workflow fields |

### Delivery Workflow Collections

| Collection | Read | Write | Delete | Notes |
|---|---|---|---|---|
| `deliveryFulfillmentScans` | staff+ | never (Functions only) | admin | Scan records (Functions-only create) |
| `deliverySignatures` | staff+ | never (Functions only) | admin | Signature records (Functions-only create) |
| `deliveryDamagePhotos` | staff+ | never (Functions only) | admin | Damage photo records (Functions-only create) |
| `deliveryTechLocations` | admin | never (Functions only) | admin | Tech GPS locations (admin read only) |

### Import Collections

| Collection | Read | Write | Delete | Notes |
|---|---|---|---|---|
| `importJobs` | staff+ | staff+ | staff+ | Import job metadata |
| `importJobs/{id}/rows` | staff+ | staff+ | staff+ | Import job row data |
| `importQueue` | staff+ | staff+ | staff+ | Import processing queue |
| `importedReports` | staff+ | staff+ | staff+ | Imported report data |
| `importedReports/{id}/rows` | staff+ | staff+ | staff+ | Imported report rows |
| `referenceImports` | staff+ | admin | admin | Reference data imports |

### CPAP Collections

| Collection | Read | Write | Delete | Notes |
|---|---|---|---|---|
| `cpapSetupAppointments` | staff+ | staff+ | staff+ | CPAP setup appointments |
| `cpapSupplyPulls` | staff+ | staff+ (validated) | admin | Field-validated supply pulls |
| `cpapSupplyCallNotes` | staff+ | staff+ (validated) | admin | Field-validated call notes |

### Insurance Collections

| Collection | Read | Write | Delete | Notes |
|---|---|---|---|---|
| `insuranceRecords` | staff+ | staff+ | staff+ | Insurance records |
| `insurance` | staff+ | staff+ | staff+ | Insurance data |
| `insurancePatients` | staff+ | admin | admin | Insurance-patient mapping |
| `insuranceQueue` | staff+ | admin | admin | Insurance processing queue |

### Compliance Collections

| Collection | Read | Write | Delete | Notes |
|---|---|---|---|---|
| `complianceIssues` | staff+ | staff+ | staff+ | Compliance issues |
| `tasks` | staff+ | staff+ | staff+ | Task management |
| `hospiceOversight` | staff+ | staff+ | staff+ | Hospice oversight |
| `equipmentRecalls` | staff+ | staff+ | staff+ | Equipment recall records |
| `recallMatches` | staff+ | staff+ | staff+ | Recall match records |
| `cmnQueue` | staff+ | staff+ | staff+ | CMN (Certificate of Medical Necessity) queue |
| `parAlerts` | staff+ | staff+ | staff+ | PAR (Prior Authorization Request) alerts |

### Retail/Shop Collections

| Collection | Read | Write | Delete | Notes |
|---|---|---|---|---|
| `shopItems` | staff+ | admin | admin | Shop item catalog |
| `shopInventoryLots` | staff+ | admin | admin | Shop inventory lots |
| `shopInventorySerials` | staff+ | admin | admin | Shop inventory serials |
| `shopGlAccountGroups` | staff+ | admin | admin | GL account groups |
| `shopGlDetails` | staff+ | admin | admin | GL detail records |
| `shopCostOfGoodsSold` | staff+ | admin | admin | COGS records |
| `shopRawReports` | staff+ | admin | admin | Raw shop reports |

### AI Collections

| Collection | Read | Write | Delete | Notes |
|---|---|---|---|---|
| `aiConversations` | staff+ | staff+ (create: self, update) | admin | AI conversation metadata |
| `aiConversations/{id}/messages` | staff+ | staff+ (create: self, no update) | admin | AI conversation messages |

### Audit & Security Collections

| Collection | Read | Write | Delete | Notes |
|---|---|---|---|---|
| `auditLogs` | admin | never (Functions only) | never | Immutable audit trail |
| `phiAlerts` | staff+ | admin | admin | PHI safety alerts |
| `improvementProposals` | staff+ | admin (create/update) | never | Improvement proposals |

### Employee Collections

| Collection | Read | Write | Delete | Notes |
|---|---|---|---|---|
| `employeeEvaluations` | tank | tank | tank | Employee evaluations (tank-only) |
| `employeeEvaluationComments` | tank | tank | tank | Evaluation comments (tank-only) |
| `employeeEvaluationSnapshots` | tank | tank | tank | Evaluation snapshots (tank-only) |

### Other Collections

| Collection | Read | Write | Delete | Notes |
|---|---|---|---|---|
| `rolodexContacts` | staff+ | staff+ | admin | Contact directory |
| `qrCards` | staff+ | staff+ | admin | QR code cards |
| `qrScanEvents` | staff+ | staff+ (create) | admin | QR scan events |
| `retailCustomerContacts` | staff+ | staff+ | admin | Retail customer contacts |
| `notifications` | staff+ | staff+ | staff+ | User notifications |
| `wipRecords` | staff+ | staff+ | staff+ | Work-in-progress records |
| `chartExportLogs` | admin | staff+ (create) | admin | Chart export logs |

### Collection Group Rules

| Pattern | Read | Write | Notes |
|---|---|---|---|
| `{path=**}/rows/{rowId}` | staff+ | staff+ | Allows collection group queries on `rows` subcollections |

### Catch-All Rule

```javascript
match /{document=**} {
  allow read, write: if false;
}
```

All collections not explicitly matched are denied.

## Protected Field Validation

### Inventory Protected Fields

These fields cannot be modified by client-side Firestore writes. Only
`movementService.ts` (Cloud Functions) may update them:

```
quantityOnHand, available, onRent, onTruck, committed, allocated, reserved,
patientId, patientKey, patientName, rentalId, locationId, warehouseId,
status, inventoryStatus, rentalStatus, assignmentStatus, lifecycleStatus,
isDeleted, deleted, deletedAt, archived, discontinued
```

**Create constraint:** New inventory documents must have safe stock defaults
(all stock fields = 0, no patient/rental assignment, safe status/lifecycle
defaults, not deleted/archived/discontinued). Current client helpers avoid
writing these protected fields directly where possible.

**Update constraint:** Updates cannot change any protected field.

### Inventory Write Enforcement

The application enforces inventory integrity in three layers:

1. Cloud Functions are the authoritative writers for protected inventory state
   through `functions/src/inventory/movementService.ts` and domain workflow
   services.
2. Firestore rules deny client updates to protected inventory fields and deny
   all client writes to `stockMovements`, `inventoryOperations`,
   `inventoryTransactions`, and `auditLogs`.
3. Client metadata helpers call `src/lib/inventory/protectedFields.ts`, and
   `scripts/validate-inventory-writes.cjs` statically blocks direct or generic
   helper writes to protected inventory fields outside authorized services.

### Delivery Workflow Protected Fields

```
loadedScanCount, deliveredScanCount, returnedScanCount, damagePhotoCount,
lastDamagePhotoUploadedAt, fulfillmentStatus, fulfillmentLines,
completedAt, completedByUid, completedByEmail, signatureStatus,
signatureId, signatureStoragePath, signatureDownloadURL, signedByName,
signedByRole, signerRelationship, witnessName, refusalReason, signedAt,
signedByCapturedUser, signedByCapturedEmail, lastTechLatitude,
lastTechLongitude, lastTechAccuracy, lastTechName, lastTechLocationAt,
etaMinutes, routeSequence, routeStatus, routeNotes, routeUpdatedBy,
routeUpdatedByEmail, routeUpdatedAt, workflowStatus, workflowCompletedAt
```

### Rental Workflow Protected Fields

```
status, patientId, patientName, inventoryItemId, itemId,
checkedOutAt, checkedOutByUid, checkedOutByEmail,
returnedDate, returnedAt, returnedByUid, returnedByEmail,
returnMovementId, movementId,
cancelledAt, cancelledByUid, cancelledByEmail
```

Client-created rental documents must be draft metadata records. Direct client
creates are denied unless `status == "draft"` and none of the protected rental
linkage, checkout, return, movement, or cancellation fields are present.
Checked-out rentals must be created with `createAndCheckoutRentalWorkflow`.

### Patient Equipment Protected Fields

```
inventoryId, productId, status, assignedAt, assignedByUid, assignedByEmail,
closedAt, closedByUid, closedByEmail, movementId, deliveryTicketId,
deliveryTicketNumber, deliveredAt, returnedAt, systemGenerated
```

Client creates and updates under `patients/{id}/equipment` cannot set or change
these fields. Assignment, closure, replacement, transfer, lost/damaged, and
warehouse-return state must be written by `patientEquipmentWorkflowCallable`.

### Patient Lifecycle Protected Fields

```
status, archivedAt, restoredAt, destroyedAt, tombstoned,
lifecycleUpdatedByUid, lifecycleUpdatedByEmail, lifecycleReason
```

### CPAP Field Validators

`validCpapSupplyPull(data)` validates:
- Required: `patientKey`, `supplyId`, `dueDate`, `status`
- `status` must be `pulled`, `picked_up`, or `cancelled`
- String length limits on all fields

`validCpapSupplyCallNote(data)` validates:
- Required: `patientKey`, `notes`
- `notes` max 4000 characters
- String length limits on all fields

### User Self-Update Protection

Users updating their own profile cannot change:
```
active, deleted, disabled, role, uid
```

## Composite Indexes

Defined in `firestore.indexes.json` (537 lines). Key indexes:

### Import Collections

- `importQueue`: status + createdAt, importId + status
- `importJobs`: status + completedAt, status + createdAt (desc), reportType + createdAt (desc), duplicateKey + createdAt (desc)

### Orders

- isHospice + status + createdAt (desc)
- status + createdAt (desc)
- status + isHospice + createdAt (desc)
- patientId + createdAt (desc)
- patientKey + updatedAt (desc)
- deliveryDate + status
- status + orderDate (desc)

### Patients

- isHospice + updatedAt (desc)
- status + updatedAt (desc)
- lastName + firstName + dateOfBirth
- patients_index: lastName + firstName
- patients_index: birthMonth + birthDay

### Hospice Patients

- active + patientName
- status + updatedAt (desc)
- assignedNurse + updatedAt (desc)
- hospiceStatus + patientName + updatedAt (desc)

### WIP Records

- status + updatedAt (desc)
- assignedTo + updatedAt (desc)
- department + updatedAt (desc)
- priority + updatedAt (desc)

### Audit Logs

- timestamp (desc)
- action + timestamp (desc)
- success + timestamp (desc)
- performedByEmail + timestamp (desc)
- performedByUid + timestamp (desc)
- action + success + timestamp (desc)
- action + performedByEmail + timestamp (desc)

### Inventory Transactions

- timestamp (desc)
- normalizedBarcode + timestamp (desc)
- transactionType + timestamp (desc)
- performedByUid + timestamp (desc)
- normalizedBarcode + transactionType + timestamp (desc)
- normalizedBarcode + transactionType + performedByUid + timestamp (desc)

### Other Indexes

- `tasks`: status + dueDate, assignedTo + status + updatedAt (desc)
- `cmnQueue`: status + dueDate
- `parAlerts`: status + expiresAt
- `equipmentRecalls`: status + publishedAt (desc)
- `recallMatches`: status + matchedAt (desc)
- `notifications`: userId + read + createdAt (desc)
- `aiConversations`: createdBy + updatedAt (desc)
- `insuranceRecords`: isHospice + importedAt (desc), patientKey + importedAt (desc), reportType + importedAt (desc), reportType + isHospice + importedAt (desc)
- `insurance`: reportType + patientName + createdAt (desc)
- `rows` (collection group): reportType + createdAt (desc), selectedReportType + createdAt (desc), detectedReportType + createdAt (desc), primaryReportType + createdAt (desc), reportTypes (array-contains) + createdAt (desc), selectedReportTypes (array-contains) + createdAt (desc)
- `rentals`: patientId + status
- `patientDeliveryTickets`: patientKey + fulfillmentStatus

### Field Overrides (Disabled Indexes)

Auto-indexing is disabled for large/raw fields:

- `importJobs`: `rawHeaders`, `sampleRows`
- `insuranceRecords`: `raw`
- `orders`: `raw`
- `patients`: `raw`
- `rows`: `raw`, `rawData`
- `wipRecords`: `raw`

## Storage Rules

Cloud Storage rules (`storage.rules`, 442 lines) protect file uploads:

| Path | Read | Create/Update | Delete | Validation |
|---|---|---|---|---|
| `reports/` | staff+ | staff+ (CSV, ≤100MB) | admin | Report files only |
| `report-staging/` | staff+ | staff+ (CSV, ≤100MB) | admin | Report staging |
| `imports/` | staff+ | staff+ (CSV, ≤100MB) | admin | Import files |
| `import-jobs/` | staff+ | staff+ (≤100MB) | admin | Import artifacts |
| `generated-reports/` | staff+ | staff+ | admin | Generated exports |
| `analytics-exports/` | staff+ | staff+ | admin | Analytics exports |
| `workflow-pending/delivery/{ticketId}/signatures/` | staff+ | staff+ (image, ≤15MB) | admin | Delivery signatures |
| `workflow-pending/delivery/{ticketId}/damage-photos/` | staff+ | staff+ (image, ≤15MB) | admin | Damage photos |
| `patient-documents/` | staff+ | staff+ (PDF/image, ≤50MB) | admin | Patient documents |
| `patientDocuments/` (legacy) | staff+ | staff+ (PDF/image, ≤50MB) | admin | Legacy path |
| `user-avatars/` | staff+ | self (image, ≤25MB) | self or admin | User avatars |
| `ai-generated/` | staff+ | staff+ | admin | AI generated files |
| `tmp/` | staff+ | staff+ | staff+ | Temp processing |
| `extensions/` | never | never | never | Firebase extensions |
| `{allPaths=**}` | never | never | never | Deny all else |
