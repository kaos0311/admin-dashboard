# Inventory Architecture Consolidation Audit

Date: 2026-08-17

## 1. Executive Summary

This audit documents the consolidated inventory architecture at closure HEAD
`9fbb37a`. No application source, package files, tests, config, Firebase
resources, Cloudflare configuration, deployment state, or git history were
changed as part of this documentation update.

Current inventory architecture is server-authoritative for mutation workflows:

- `functions/src/inventory/movementService.ts` is the canonical stock authority.
- `functions/src/inventory/inventoryScanResolver.ts` owns backend scan
  normalization, inventory candidate lookup, deleted-record filtering, and
  fail-closed ambiguity classification.
- `functions/src/inventory/manualInventoryUpsert.ts` is server-authoritative for
  inventory create/merge, identity matching, and identity-lock maintenance.
- `functions/src/inventory/manualInventoryMetadataUpdate.ts` is server-authoritative
  for existing-record metadata edits and transactional identity-lock updates.
- `functions/src/inventory/receiveScannedInventoryIntake.ts` and compatibility
  scanner callables route mutation requests through the canonical movement service
  or scanned-intake authority with stable operation IDs.
- `src/services/inventory/inventory-scan-adapter.ts` is client-side presentation
  only; it is not mutation authority.
- Identity-lock lifecycle behavior is covered by focused emulator regression tests
  proving hard-delete reclaimability, archive reclaimability, discontinued-item
  identity reservation, and concurrent reclaim serialization.

The largest remaining architecture debt is informational or future schema work.
No BLOCKER/HIGH findings remain.

## 2. Current Architecture Map

Core backend inventory modules:

| Area | Files | Role |
| --- | --- | --- |
| Movement service | `functions/src/inventory/movementService.ts` | Canonical inventory quantity/status/location movement engine, movement validation, idempotency through `inventoryOperations`, movement history in `inventoryTransactions`, audit logging, reconciliation support |
| Backend scan resolver | `functions/src/inventory/inventoryScanResolver.ts` | Canonical backend scan normalization, inventory lookup, matched-field tracking, deleted-record filtering, document-id resolution when requested, and fail-closed ambiguity classification |
| Movement callables | `functions/src/inventory/movementFunctions.ts` | `createInventoryMovementCallable`, `reverseInventoryMovementCallable`, `reconcileInventoryCallable`; includes `retail_sale` in the callable movement allowlist |
| Receive by barcode | `functions/src/inventory/receiveInventoryByBarcode.ts` | Compatibility receive callable using movement service |
| Scanned intake | `functions/src/inventory/receiveScannedInventoryIntake.ts` | Product-match and pending-scan intake using `InventoryResolutionPlan` plus prepared movement writes |
| Legacy scanner operations | `functions/src/inventory/inventoryTransactionFunctions.ts` | Issue, cycle-count, and transfer compatibility callables using movement service |
| Lookup | `functions/src/inventory/lookupInventoryByBarcode.ts` | Server-side scan lookup over barcode, serial, lot, SKU |
| Scanner check-in workflow | `functions/src/domainWorkflows/scannerCheckInWorkflowService.ts` | Server-side equipment check-in resolver over rental, patient-equipment, explicit warehouse, conflict, and orphan states |
| Domain workflow callables | `functions/src/domainWorkflows/domainWorkflowFunctions.ts` | Rental, patient-equipment, delivery, patient lifecycle, scanner equipment check-in, and upload-cleanup callable exports |
| Cleanup | `functions/src/inventory/cleanupWorkflow.ts` | Admin-only metadata cleanup, review/dismiss, idempotency through `domainWorkflowOperations` |
| Shared workflow primitives | `functions/src/domainWorkflows/shared.ts` | Domain operation claim/complete helpers, fingerprint checks, transition assertions, audit helper |

Client architecture:

| Area | Files | Role |
| --- | --- | --- |
| Callable wrappers | `src/lib/domainWorkflows.ts`, `src/lib/inventory/*.ts` | Client entry points to server workflows and movement callables |
| Inventory UI state | `src/app/(admin)/inventory/hooks/**` | React state and workflow invocation, including retry ledgers for save, scan, archive, discontinue, hard delete, and batch operations |
| Scanner UI | `src/app/(admin)/inventory/scanner/page.tsx` | Lookup, Receive Stock, Distribute / Issue, Rental Check-Out, Equipment Check-In, Retail Sale, Transfer Location, and Cycle Count |
| Inventory browser identity | `src/app/(admin)/inventory/lib/inventoryIndex.ts` | Category/product/serialized/quantity grouping |
| Inventory normalization | `src/app/(admin)/inventory/lib/inventoryNormalize.ts` | Client read-model normalization |
| Repository | `src/repositories/firestore/inventory.repository.ts` | Client reads plus guarded metadata writes |
| Static validators | `scripts/validate-inventory-writes.cjs`, `scripts/validate-domain-writes.cjs` | Direct protected-write detection |
| Golden and emulator tests | `functions/src/golden/golden-regression.emulator.test.ts`, `functions/src/test-utils/scanner-workflows.emulator.test.ts`, `tests/golden/GOLDEN_REGRESSION_MANIFEST.md` | Emulator/unit coverage contract for protected inventory paths |

## 2a. Current Authority Model

| Concern | Canonical owner | Invariant |
| --- | --- | --- |
| Scan resolution | `functions/src/inventory/inventoryScanResolver.ts` | Backend resolver owns normalization, candidate lookup, deleted-record filtering, and ambiguity classification. Fails closed. |
| Stock authority | `functions/src/inventory/movementService.ts` | All quantity, status, and location mutations flow through `createInventoryMovementInTransaction`. No direct client stock writes. |
| Scanner mutations | `createInventoryMovementCallable` / scanned intake | Client supplies stable operation ID; backend resolves canonical `inventoryItemId`. `movement.inventoryItemId` is authoritative after success. |
| Manual create/merge | `functions/src/inventory/manualInventoryUpsert.ts` | Server-authoritative identity matching, ambiguity handling, and identity-lock writes. New records start at zero stock. |
| Existing metadata | `functions/src/inventory/manualInventoryMetadataUpdate.ts` | Server-authoritative metadata-only edits. Rejects stock, assignment, status, lifecycle, and location/bin fields. Updates identity locks transactionally. |
| Location/bin transfer | `warehouse_transfer` movement in `movementService.ts` | Validates source snapshot, updates `locationName`/`binLocation`, preserves stock totals, and atomically releases/reclaims location-scoped identity locks. |
| Identity locks | `inventoryIdentityLocks` collection | Create/merge, metadata edits, and transfers maintain locks. Hard delete and archive may leave stale lock docs, but missing/archived owners are reclaimable. Discontinue intentionally preserves identity reservation. |
| Idempotency | `inventoryOperations` / `domainWorkflowOperations` | Caller-owned stable operation IDs with request fingerprints. Duplicate replay is deterministic. Conflicting fingerprint reuse is rejected. |

## 3. Mutation Entry Points

Grouped inventory-related mutation entry points documented in this audit: 24.
This is a qualified grouped count, not a raw callable count. Some rows collapse
multi-action callables, such as patient-equipment operations and delivery scan
states, because those actions share one callable boundary and one transaction
owner.

| Entry point | UI/client | Callable | Auth | Transaction owner | Movement/audit/idempotency |
| --- | --- | --- | --- | --- | --- |
| Receive inventory by barcode | `src/lib/inventory/receive-inventory.ts` | `receiveInventoryByBarcode` | inventory role helper | movement service | `inventoryOperations`, `inventoryTransactions`, `auditLogs` |
| Scanned product-match intake | `src/lib/inventory/receive-scanned-inventory-intake.ts` | `receiveScannedInventoryIntakeCallable` | inventory role helper | scanned intake + prepared movement | same operation id in movement and intake metadata |
| Scanned pending intake | same | same | inventory role helper | scanned intake + prepared movement | same |
| Manual movement | `src/lib/inventory/movements.ts` | `createInventoryMovementCallable` | inventory role helper | movement service | yes |
| Retail sale movement | scanner UI / `src/lib/inventory/movements.ts` | `createInventoryMovementCallable` | inventory role helper | movement service | yes; decrements stock or retires serialized asset |
| Hard delete movement | same | same | admin/tank enforced in service | movement service | yes |
| Reverse movement | same | `reverseInventoryMovementCallable` | inventory role helper | movement service | yes |
| Reconciliation dry run/repair marker | internal/admin UI | `reconcileInventoryCallable` | admin/tank | reconciliation service | audit only; no silent repairs |
| Issue by barcode | scanner compatibility | `issueInventoryByBarcode` | inventory role helper | movement service | yes |
| Cycle count by barcode | scanner compatibility | `cycleCountInventoryByBarcode` | inventory role helper | movement service | yes |
| Transfer by barcode | scanner compatibility | `transferInventoryByBarcode` | inventory role helper | movement service | yes |
| Rental checkout | `src/lib/domainWorkflows.ts`, scanner UI | `checkoutRentalWorkflowCallable` | domain role helper | rental workflow | domain op + movement + audit + timeline/equipment |
| Rental create and checkout | same | `createAndCheckoutRentalWorkflowCallable` | domain role helper | rental workflow | same |
| Rental return | same | `returnRentalWorkflowCallable` | domain role helper | rental workflow | same |
| Scanner equipment check-in | scanner UI | `equipmentCheckInByBarcodeCallable` | rate-limited domain role helper | scanner check-in workflow | domain op + canonical rental or patient return workflow + audit; already-warehouse is idempotent |
| Rental exchange | same | `exchangeRentalWorkflowCallable` | domain role helper | rental workflow | return + checkout movement + audit |
| Rental cancel | same | `cancelRentalWorkflowCallable` | domain role helper | rental workflow | no movement; domain op + audit |
| Stale rental draft report | admin-only callable | `reportStaleRentalDraftsCallable` | admin/tank | rental service | audit |
| Patient equipment assign/remove/transfer/recover/replace/lost/damaged/return | `src/lib/domainWorkflows.ts` | `patientEquipmentWorkflowCallable` | domain role helper | patient equipment workflow | movement + timeline + audit + domain op |
| Delivery scan load/deliver/return | `src/lib/domainWorkflows.ts` | `recordDeliveryScanWorkflowCallable` | domain role helper | delivery workflow | movement for delivered/returned paths |
| Complete delivery ticket | same | `completeDeliveryTicketWorkflowCallable` | domain role helper | delivery workflow | domain op + audit |
| Finalize delivery signature | same | `finalizeDeliverySignatureWorkflowCallable` | domain role helper | delivery workflow | documents/timeline/audit |
| Finalize delivery damage photos | same | `finalizeDeliveryDamagePhotosWorkflowCallable` | domain role helper | delivery workflow | documents/timeline/audit |
| Inventory cleanup apply | `src/lib/domainWorkflows.ts` | `inventoryCleanupWorkflowCallable` | admin only | cleanup workflow | domain op + audit; no movement |

## 4. Firestore Write Map

The previous audit listed 43 Firestore write clusters. This refresh does not
carry that number forward as an absolute count because the current architecture
contains grouped workflow actions, compatibility callables, and shared movement
builders where a raw `set/update/delete` count would be misleading. The source
verified map below is therefore grouped by authoritative write owner.

| Write owner | Main collections touched | Notes |
| --- | --- | --- |
| Movement service | `inventory`, `inventoryTransactions`, `inventoryOperations`, `auditLogs` | Canonical stock movement, reverse movement, retail sale, hard delete, archive, discontinue, reconciliation markers |
| Scanned intake | `inventory`, `inventoryTransactions`, `inventoryOperations`, pending scan metadata | Uses prepared movement writes and idempotent operation IDs |
| Rental workflows | `rentals`, `rentalEquipment`, `inventory`, `inventoryTransactions`, `auditLogs`, timeline/equipment records | Checkout, return, exchange, cancel, create-and-checkout |
| Patient equipment workflows | patient equipment records, `inventory`, `inventoryTransactions`, patient timeline, `auditLogs` | Assign, remove, transfer, recover, replace, lost, damaged, return-to-warehouse |
| Scanner check-in workflow | `domainWorkflowOperations`, rental or patient workflow-owned collections, `auditLogs` | Resolves scanned asset state and delegates to canonical return workflow or returns already-in-warehouse |
| Delivery workflows | delivery ticket state, route scans, documents, patient timeline, `auditLogs`, movement records for delivered/returned paths | Delivery scan/load/deliver/return and finalization paths |
| Cleanup workflow | metadata cleanup collections/state, `domainWorkflowOperations`, `auditLogs` | Admin-only cleanup; intentionally excludes stock, rental, and patient-equipment mutation |
| Repository metadata writes | `inventory` metadata fields only | Firestore rules and static validators block protected stock/assignment fields |

## 5. Scanner Architecture

The scanner page now exposes eight modes: Lookup, Receive Stock, Distribute / Issue,
Rental Check-Out, Equipment Check-In, Retail Sale, Transfer Location, and Cycle Count.
It checks
`canAccessCommandCenter && hasPermission(role, "inventory:write")` before write
actions and routes write modes through callable workflows instead of direct
client-side protected-field writes.

Scanner architecture is improved and now uses one backend resolver contract for
mutation-time inventory-item scan resolution:

- Equipment check-in is server authoritative through
  `equipmentCheckInByBarcodeCallable` and resolves scanned inventory through
  `inventoryScanResolver.ts` before ownership classification.
- Retail sale uses the canonical movement callable with `movementType:
  "retail_sale"`; movement scan fallback also routes through
  `inventoryScanResolver.ts`.
- Existing-inventory scan mutations are server-first. The client sends scan
  context plus a stable operation ID to `createInventoryMovementCallable`; the
  backend resolver selects the canonical `inventoryItemId`, and
  `movement.inventoryItemId` is the authoritative identity after success.
- Receive Stock remains connected to the existing scanned intake and receive movement
  paths. Definitive movement `not_found` may enter intake assistance; ambiguity,
  permission, validation, conflict, stock, transport, and internal failures do
  not become product fallback identity.
- Distribute / Issue, Transfer Location, and Cycle Count remain routed through the
  compatibility scanner callables backed by the canonical movement service. Their
  scan lookup now uses the shared resolver and fails closed on ambiguity. These
  public compatibility callable names remain exported, but mutation requests now
  require explicit caller-supplied operation IDs; retry-unstable compatibility-wrapper
  fallback IDs are not generated.
- Rental Check-Out does not invent missing rental or patient context. When scanner-only
  input cannot satisfy the canonical rental checkout requirements, it fails closed and
  directs the user to the rental workflow.
- Compatibility scanner callables for issue, cycle count, and transfer still
  exist in `functions/src/inventory/inventoryTransactionFunctions.ts`.
- The backend resolver supports caller-selected field sets so generic scanner
  identity does not accidentally absorb product fallback identity. Default item
  identity covers barcode, serial, serialNumber, lotNumber, and SKU; movement
  keeps its broader legacy manufacturerItemId/productId fallback as an explicit
  caller option.
- Remaining client-side scan interpretation is product-intake presentation
  support in `src/services/inventory/inventory-scan-adapter.ts`. Manual
  inventory create-or-merge target selection now runs through
  `manualInventoryUpsertCallable`.
  The adapter distinguishes inventory presentation from product suggestions, is
  not mutation authority, and cannot veto canonical movement resolution.
  Product suggestions intentionally do not expose `inventoryItemId`.

Scanner mode authority map:

| Mode | Canonical server authority | Notes |
| --- | --- | --- |
| Lookup | `lookupInventoryByBarcode` / `inventoryScanResolver.ts` | Read-only scan resolution |
| Receive Stock | `receiveScannedInventoryIntakeCallable` / movement service | Product-match or pending-scan intake with prepared movement writes |
| Distribute / Issue | `issueInventoryByBarcode` / movement service | Compatibility callable; shared resolver + stable operation ID |
| Rental Check-Out | `checkoutRentalWorkflowCallable` / rental workflow | Domain workflow; scanner-only input fails closed when rental/patient context is missing |
| Equipment Check-In | `equipmentCheckInByBarcodeCallable` / scanner check-in workflow | Server-authoritative ownership classification; idempotent already-in-warehouse |
| Retail Sale | `createInventoryMovementCallable` / movement service | `retail_sale` movement type; serialized sale retires asset |
| Transfer Location | `transferInventoryByBarcode` / movement service | Compatibility callable; canonical `warehouse_transfer` with source snapshot validation |
| Cycle Count | `cycleCountInventoryByBarcode` / movement service | Compatibility callable; shared resolver + stable operation ID |

Backend mutation-time scan resolution is consolidated for existing-inventory scan
movements, and manual inventory create-or-merge target selection is
server-authoritative.

## 6. Equipment Check-In and Warehouse Custody

`functions/src/domainWorkflows/scannerCheckInWorkflowService.ts` treats warehouse
custody as an explicit valid state instead of inferring custody only from missing
active assignments.

Current classification:

| State | Behavior |
| --- | --- |
| Active rental only | Delegates to canonical rental return workflow |
| Active patient equipment assignment only | Delegates to canonical patient return-to-warehouse workflow |
| Explicit warehouse state with no active assignment | Returns already-in-warehouse without adding stock |
| Active rental and active patient assignment | Fails closed as a data-integrity conflict |
| No active ownership and no provable warehouse state | Fails closed as orphan/legacy ownership requiring reconciliation |

Successful check-in leaves the item in warehouse custody using existing inventory
fields rather than introducing a new `custodyType` field. The workflow preserves
historical rental/patient records, clears active rental/patient assignment fields
through the canonical return workflow, and relies on movement/audit history for
traceability. Repeated physical scans after a successful return resolve as
already-in-warehouse and do not increment inventory again.

## 7. Retail Sale

Retail sale is implemented as a movement type rather than a separate write path.
`functions/src/inventory/movementFunctions.ts` includes `retail_sale` in the
accepted movement set, and `functions/src/inventory/movementService.ts` owns the
write behavior.

Current behavior:

- Quantity-managed retail sale decrements available quantity.
- Insufficient stock fails closed.
- Rented serialized assets are rejected.
- Available serialized assets can be sold once; the service marks them inactive
  and retired.
- Serialized retail sale clears active assignment-style fields such as
  `patientId` and `assignedTo` where applicable.
- Duplicate operation IDs with matching fingerprints return stored duplicate
  results instead of applying another sale.

## 8. Idempotency and Retry Lifecycle

Server-side idempotency is now present across both movement and domain workflow
families:

- Movement operations use `inventoryOperations/{uid}_{operationId}` with request
  fingerprints, stored results, and conflict rejection for reused IDs with
  different fingerprints.
- Manual inventory upsert uses the same operation collection. The operation
  read, request fingerprint check, target resolution, inventory create/merge,
  identity-lock updates, and stored result write execute in one Firestore
  transaction.
- Existing-record manual metadata edits also use `inventoryOperations`. The
  operation read, fingerprint check, inventory read, identity conflict checks,
  identity-lock updates, metadata write, and stored result write execute in one
  Firestore transaction.
- Scanner compatibility mutation callables require explicit stable operation IDs
  before scan resolution and reuse the movement operation-ID validator.
- Domain workflows use `domainWorkflowOperations/{uid}_{operationId}` with exact
  JSON fingerprints, stored completion results, and duplicate-result replay.
- Scanner equipment check-in additionally validates that a reused operation ID
  is not being applied to a different scanned asset.

Client retry lifecycle coverage has also expanded:

- `src/lib/inventory/receive-inventory.ts` documents and manages receive
  operation IDs from start through definitive completion or reset.
- `src/app/(admin)/inventory/lib/saveMovementLifecycle.ts` preserves one logical
  save mutation across uncertain responses.
- `scanMovementRetry.ts`, `scan-intake-retry.ts`, `archiveLifecycle.ts`,
  `discontinueLifecycle.ts`, and `hardDeleteLifecycle.ts` preserve operation IDs
  for their respective retry paths.
- `batchMutationLifecycle.ts` stores per-item operation IDs in a batch ledger and
  resumes only pending/uncertain entries rather than rerunning completed or
  failed entries.
- `useInventoryActions.ts` prevents concurrent batch inventory actions through
  in-flight guards.

Remaining qualification: the batch ledger is an in-memory UI lifecycle, not a
durable server-side batch job record. That is acceptable for the current retry
model because each item still uses its own server idempotency key, but it should
not be represented as durable batch orchestration.

## 9. Authorization

Inventory callable authorization is centralized through
`functions/src/inventory/auth.ts` and domain workflow helpers in
`functions/src/domainWorkflows/domainWorkflowFunctions.ts`.

Current access model:

- Inventory callables require an authenticated, active role resolved from token
  or user record.
- Allowed inventory roles are `admin`, `staff`, `technician`, `manager`, and
  `tank`.
- Billing and read-only roles remain excluded.
- Admin/tank-only paths remain narrower where the workflow requires it, including
  reconciliation, stale-rental reporting, and destructive movement controls.
- The scanner UI also checks command-center access plus `inventory:write` before
  write actions.
- `equipmentCheckInByBarcodeCallable` uses the rate-limited staff/admin domain
  helper before invoking the scanner check-in workflow.

The 2026-08-12 finding about duplicated scanner callable auth is resolved for
the compatibility scanner callables inspected in this refresh.

## 10. Golden and Emulator Coverage

Current relevant coverage:

| Coverage | Evidence |
| --- | --- |
| Golden inventory regression | `functions/src/golden/golden-regression.emulator.test.ts` imports `createInventoryMovementCallable`, `inventoryCleanupWorkflowCallable`, `returnRentalWorkflowCallable`, and `patientEquipmentWorkflowCallable` |
| Scanner equipment check-in | `functions/src/test-utils/scanner-workflows.emulator.test.ts` covers rental return, duplicate operation replay, repeated physical scan already-in-warehouse, patient return, conflict rejection, explicit warehouse custody, orphan rejection, permission denial, and conflicting operation reuse |
| Scanner retail sale | same emulator test covers normal quantity sale, insufficient stock, rented serialized rejection, serialized sale, repeat serialized sale rejection, duplicate operation replay, and permission denial |
| Shared backend scan resolver | `functions/src/inventory/inventoryScanResolver.test.ts` covers barcode, serial, lot, SKU, document ID, normalization, no match, ambiguity, deleted filtering, multi-field same-document dedupe, serialized identifier resolution, quantity inventory resolution, and caller-selected manufacturer matching |
| Compatibility scanner callables | `functions/src/test-utils/scanner-workflows.emulator.test.ts` covers issue, cycle count, transfer, explicit operation ID success, duplicate replay, same-ID/different-request conflict, missing/malformed operation ID rejection, not-found, ambiguous scan failure, unauthorized denial, and disabled-user denial through the shared resolver and canonical movement service |
| Client retry lifecycle | `src/app/(admin)/inventory/lib/*Lifecycle.test.ts`, `scanMovementRetry.test.ts`, and `scan-intake-retry.test.ts` cover operation ID preservation and duplicate handling for save, scan, archive, discontinue, hard delete, and batch retry paths |
| Identity-lock lifecycle | `functions/src/test-utils/inventory-identity-lock-lifecycle.emulator.test.ts` covers hard-delete identity reclaimability, archive identity reclaimability, discontinued-item identity reservation, scanner resolver behavior for deleted/retired inventory, and concurrent reclaim serialization to one active winner |

Most recent validation evidence available from this workspace context:

- Scanner workflows emulator test passed with
  `npx firebase emulators:exec --project demo-advanced-home-medical --only firestore,auth "npx vitest run --config vitest.integration.config.ts src/test-utils/scanner-workflows.emulator.test.ts"`.
- Shared resolver unit test passed with
  `npx vitest run --config vitest.config.ts src/inventory/inventoryScanResolver.test.ts`.
- Golden regression emulator test passed with
  `npx firebase emulators:exec --project demo-advanced-home-medical --only firestore,auth "npx vitest run --config vitest.integration.config.ts src/golden/golden-regression.emulator.test.ts"`.

## 11. Resolved Findings

These findings were present in earlier audit passes and are now resolved in the
current source:

- Duplicated scan resolution authority — consolidated in
  `functions/src/inventory/inventoryScanResolver.ts` (commit `d2f81f2`).
- Client-derived scanner inventory target — scanner mutations now send scan
  context plus stable operation IDs to backend callables; backend resolver
  selects canonical `inventoryItemId` (commit `6146176`).
- Retry-unstable scanner operation IDs — compatibility scanner callables now
  require explicit stable operation IDs; wrapper fallback IDs were removed
  (commit `96a3133`).
- Client stock mutation authority — all stock mutations route through
  `movementService.ts`; direct client writes are blocked by Firestore rules and
  static validators (commit `6146176`).
- Manual create/merge client authority — `manualInventoryUpsertCallable` is
  server-authoritative with identity matching, ambiguity handling, and
  identity-lock writes in one transaction (commit `5417a33`).
- Existing metadata direct authority — `manualInventoryMetadataUpdateCallable` is
  server-authoritative and rejects protected fields (commit `91c1b30`).
- Location/bin direct mutation authority — location/bin changes route through
  canonical `warehouse_transfer` movement with source snapshot validation and
  atomic identity-lock migration (commit `99dfb4a`).
- Identity-lock lifecycle ambiguity — emulator regression tests prove hard-delete
  reclaimability, archive reclaimability, discontinued-item identity reservation,
  and concurrent reclaim serialization (commit `9fbb37a`).
- Backup artifacts — tracked source-tree backup artifacts were removed from the
  repository and are no longer part of architecture debt.
- Duplicated scanner callable auth — consolidated through shared role helpers.

## 12. Remaining Non-Blocking Debt

These items are informational or acceptable trade-offs. None are BLOCKER/HIGH.

1. Client product-intake scan adaptation remains in
   `src/services/inventory/inventory-scan-adapter.ts`. It supports UI intake
   presentation and product suggestions only; inventory-page scan movements now
   send scan context to the server before any client intake lookup and do not use
   client-selected document IDs or cached availability as mutation authority.
2. Compatibility scanner mutation callables still coexist with the newer scanner
   UI and domain workflow paths, although their inventory lookup semantics now
   route through the shared backend resolver and their retry-unstable client-wrapper
   operation-ID fallbacks have been removed.
3. `movementService.ts`, `receiveScannedInventoryIntake.ts`, and
   `domainWorkflowFunctions.ts` are large modules. Size alone is not a correctness
   defect, but future changes should avoid increasing branching complexity there
   without tests.
4. Batch archive/discontinue retry state is client-lifecycle state, not durable
   batch orchestration.
5. Retail sale is covered as a movement type, but broader sales/order accounting
   integration is outside the inventory movement boundary unless a separate
   business workflow is introduced.

## 13. Future Feature Work

These are schema or domain enhancements, not blockers:

- Location model clarification: decide whether the long-term canonical location
  model needs stable `locationId`/`warehouseId` records or whether
  `locationName` remains the authoritative location value.
- Keep product-catalog suggestions separate from inventory mutation identity.
- Broader sales/order accounting integration is outside the inventory movement
  boundary unless a separate business workflow is introduced.

## 14. Closure

Inventory Architecture Consolidation Status: **CLOSED**

Closure HEAD: `9fbb37a`

Closure basis:

- No active protected client mutation authority.
- `movementService.ts` is the canonical stock authority.
- `inventoryScanResolver.ts` owns backend scan target resolution.
- `manualInventoryUpsertCallable` is server-authoritative for create/merge.
- `manualInventoryMetadataUpdateCallable` is server-authoritative for metadata edits.
- `warehouse_transfer` is the canonical location/bin authority.
- Stable operation IDs with deterministic duplicate replay.
- Identity-lock lifecycle emulator coverage proves reclaimability and reservation semantics.
- Static validators passing.
- TypeScript builds passing.
- No BLOCKER/HIGH inventory architecture findings remain.

Future inventory work should be driven by feature requirements or observed
defects, not continued authority consolidation.

## 15. Release Readiness Interpretation

This document is an architecture audit closure record. It is not a production
release approval.

Source-level state is improved for scanner check-in, warehouse custody, retail
sale, idempotency, authorization, and retry lifecycle coverage. Release readiness
still depends on the normal release gate: repository hygiene, secret preflight,
dependency audit, lint/typecheck/build/test gates, emulator regression gates, and
deployment-specific smoke checks when a deployment is intentionally performed.

## 16. Files Updated By This Closure

Only this file was updated:

- `docs/architecture/INVENTORY_ARCHITECTURE_CONSOLIDATION_AUDIT.md`
