# Inventory Architecture Consolidation Audit

Date: 2026-08-14

## 1. Executive Summary

This is a source-only refresh of the 2026-08-12 inventory architecture audit. No
application source, package files, tests, config, Firebase resources, Cloudflare
configuration, deployment state, or git history were changed as part of this
refresh.

Current source shows the inventory architecture has moved further toward
server-authoritative mutation workflows:

- Inventory movements still centralize quantity/status/location changes through
  `functions/src/inventory/movementService.ts`.
- Rental, patient-equipment, delivery, cleanup, and scanner equipment check-in
  mutations are owned by callable domain workflows under
  `functions/src/domainWorkflows/**`.
- Retail sale is now a supported movement type through
  `createInventoryMovementCallable`, with serialized sale guards in the movement
  service.
- Equipment check-in now routes through `equipmentCheckInByBarcodeCallable`,
  classifies rental, patient-equipment, warehouse, conflict, and orphan states,
  and returns idempotent already-in-warehouse results without incrementing stock.
- Client retry lifecycles now preserve operation IDs across inventory save,
  scan intake, scanner movement, archive, discontinue, hard delete, and batch
  archive/discontinue retry paths.

The largest remaining architecture debt is no longer backup artifacts or missing
scanner auth. The current debt is scan-resolution duplication, compatibility
scanner callables that still exist beside newer scanner/domain workflows, and
several broad workflow modules that remain correct but dense.

## 2. Current Architecture Map

Core backend inventory modules:

| Area | Files | Role |
| --- | --- | --- |
| Movement service | `functions/src/inventory/movementService.ts` | Canonical inventory quantity/status/location movement engine, movement validation, idempotency through `inventoryOperations`, movement history in `inventoryTransactions`, audit logging, reconciliation support |
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

Scanner architecture is improved but not fully consolidated:

- Equipment check-in is server authoritative through
  `equipmentCheckInByBarcodeCallable`.
- Retail sale uses the canonical movement callable with `movementType:
  "retail_sale"`.
- Receive Stock remains connected to the existing scanned intake and receive movement
  paths.
- Distribute / Issue, Transfer Location, and Cycle Count remain routed through the
  compatibility scanner callables backed by the canonical movement service.
- Rental Check-Out does not invent missing rental or patient context. When scanner-only
  input cannot satisfy the canonical rental checkout requirements, it fails closed and
  directs the user to the rental workflow.
- Compatibility scanner callables for issue, cycle count, and transfer still
  exist in `functions/src/inventory/inventoryTransactionFunctions.ts`.
- Scan lookup and normalization logic still appears in multiple modules:
  `lookupInventoryByBarcode.ts`, `receiveInventoryByBarcode.ts`,
  `receiveScannedInventoryIntake.ts`, `inventoryTransactionFunctions.ts`,
  `scannerCheckInWorkflowService.ts`,
  `src/services/inventory/inventory-scan-resolver.ts`, and
  `src/lib/inventory/smartMergeInventory.ts`.

Recommended interpretation: scanner mutation authority is materially better
than on 2026-08-12, but scan resolution itself should still be consolidated into
one shared resolver contract.

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
| Client retry lifecycle | `src/app/(admin)/inventory/lib/*Lifecycle.test.ts`, `scanMovementRetry.test.ts`, and `scan-intake-retry.test.ts` cover operation ID preservation and duplicate handling for save, scan, archive, discontinue, hard delete, and batch retry paths |

Most recent validation evidence available from this workspace context:

- Scanner workflows emulator test passed with
  `npx firebase emulators:exec --project demo-advanced-home-medical --only firestore,auth "npx vitest run --config vitest.integration.config.ts src/test-utils/scanner-workflows.emulator.test.ts"`.
- Golden regression emulator test passed with
  `npx firebase emulators:exec --project demo-advanced-home-medical --only firestore,auth "npx vitest run --config vitest.integration.config.ts src/golden/golden-regression.emulator.test.ts"`.

This audit refresh did not rerun emulator suites because the requested change was
documentation-only. The validation for this turn is limited to markdown
whitespace checking and git status.

## 11. Remaining Architecture Debt

Remaining source-verified debt:

1. Scan resolution is still duplicated across backend lookup, receive, scanner
   compatibility, scanner check-in, client scan resolver, and smart-merge code.
2. Compatibility scanner mutation callables still coexist with the newer scanner
   UI and domain workflow paths.
3. `movementService.ts`, `receiveScannedInventoryIntake.ts`, and
   `domainWorkflowFunctions.ts` are large modules. Size alone is not a correctness
   defect, but future changes should avoid increasing branching complexity there
   without tests.
4. Batch archive/discontinue retry state is client-lifecycle state, not durable
   batch orchestration.
5. Retail sale is covered as a movement type, but broader sales/order accounting
   integration is outside the inventory movement boundary unless a separate
   business workflow is introduced.

Resolved or materially improved since the prior audit:

- Scanner equipment check-in now has a server-authoritative workflow and
  emulator coverage.
- Warehouse custody is represented explicitly through existing inventory fields
  and idempotent already-in-warehouse handling.
- Retail sale is integrated into the canonical movement path.
- Operation IDs are preserved across multiple uncertain-response retry
  lifecycles.
- Batch archive/discontinue actions prevent concurrent runs and resume
  pending/uncertain entries by preserving per-item operation IDs.
- Tracked source-tree backup artifacts are no longer part of the architecture
  debt described by this document.

## 12. Recommended Next Architecture Task

The next architecture task should be scan-resolution consolidation:

- Define one backend scan-resolution service that accepts a normalized scan value
  and returns a typed resolution result for barcode, serial, serial number, lot,
  SKU, ambiguity, inactive/deleted filtering, and explicit ownership/custody
  metadata.
- Migrate lookup, receive, scanner compatibility callables, scanner check-in, and
  client display adapters to consume that contract.
- Preserve existing callable names while routing their internals through the
  shared resolver.
- Add emulator tests for ambiguous scans, inactive/deleted filtering, duplicate
  serial/lot/SKU matches, and legacy orphan ownership.

This is a higher-value follow-up than splitting `movementService.ts` for size
alone because it reduces duplicated workflow semantics at active scan boundaries.

## 13. Release Readiness Interpretation

This document is an architecture audit refresh only. It is not a production
release approval.

Source-level state is improved for scanner check-in, warehouse custody, retail
sale, idempotency, authorization, and retry lifecycle coverage. Release readiness
still depends on the normal release gate: repository hygiene, secret preflight,
dependency audit, lint/typecheck/build/test gates, emulator regression gates, and
deployment-specific smoke checks when a deployment is intentionally performed.

## 14. Files Updated By This Refresh

Only this file was updated:

- `docs/architecture/INVENTORY_ARCHITECTURE_CONSOLIDATION_AUDIT.md`
