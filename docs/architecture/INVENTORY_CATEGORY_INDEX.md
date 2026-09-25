# Inventory Category Index

## Current Inventory Structure

The inventory page reads from the `inventory` collection through `InventoryRepository.subscribeToInventory`, normalizes each document with `normalizeInventoryItem`, and passes a flat `InventoryItem[]` into the inventory page. The page applies existing search, status, lifecycle, alert, and sort controls before rendering the table.

Relevant collections and concepts found in source:

- `inventory`: normalized into `InventoryItem` records and used as the authoritative browser source.
- `products`: product catalog documents used by scan/product lookup flows.
- `stockMovements`: movement ledger collection; direct UI writes are intentionally blocked by repository helpers and routed through movement/workflow services.
- `patients` and `rentals`: referenced by patient/rental inventory metadata.
- `settings`: used for inventory threshold and configuration reads.
- Location is represented on inventory records with `locationName` and `binLocation`; no separate location interface was required for this read-only hierarchy.

## Current Product Schema

The inventory browser product identity is represented on each `InventoryItem` by:

- `productId`
- `name`
- `category`
- `sku`
- `hcpc`
- `barcode`
- `manufacturer`
- `manufacturerItemId`
- `modelNumber`

The repository also has a `products` collection, but the current inventory page does not join product documents into the table. The first hierarchy implementation therefore derives product grouping from the normalized inventory records already loaded by the page.

## Current Serialized Item Schema

Serialized equipment is represented by fields on `InventoryItem`:

- `serial`, normalized from `serial` or `serialNumber`
- `assetTag`
- `assetNumber`
- `barcode`
- `lotNumber`
- `locationName`
- `binLocation`
- `status`
- `lifecycleStatus`
- `quantityOnHand`
- `available`
- `onRent`
- patient/rental metadata such as `patientKey`, `patientId`, `patientName`, `rental`-adjacent dates, and returned-from fields

The category index treats `serial`, `assetTag`, or `assetNumber` as serialized-unit identifiers. Barcode remains searchable metadata but is not enough by itself to force a quantity supply into serialized-unit structure.

## Proposed Category Hierarchy

The UI now builds a read-only hierarchy:

```text
Category
    Product / Model
        Serialized unit rows
            Serial number
        Quantity inventory rows
            Location and lot
```

The hierarchy is derived from current inventory records. It does not write category IDs, merge product records, change stock quantities, or modify serialized asset state.

## Category Index

The index builder defines maintainable category definitions with:

- `id`
- `name`
- `sortOrder`
- `aliases`

Initial high-level categories are intentionally constrained to common categories already supported by visible inventory metadata patterns: Oxygen Equipment, CPAP / PAP, Respiratory, Mobility, Hospital Beds, Patient Room Equipment, Bathroom Safety, Supplies, Accessories / Replacement Parts, and Uncategorized.

If an item already has a category, that value wins. Known names or aliases map to canonical category definitions. Unknown explicit category values become dynamic category nodes rather than being dropped.

## Product Grouping Rules

Products group by stable identity:

1. `productId` when present.
2. Legacy fallback from `manufacturer`, `modelNumber`, `sku`, `hcpc`, and `name`.
3. Final fallback to the inventory item ID only when legacy identity fields are missing.

Items are never grouped by serial number, and the UI does not use fuzzy display-name matching.

## Serialized Unit Rules

An item is treated as serialized when it has `serial`, `assetTag`, or `assetNumber`. Serialized products expose unit counts and render unit rows only after the product is expanded.

Serialized unit totals use existing status semantics:

- `status: "available"` contributes to Available.
- `status: "rental_out"` or positive `onRent` contributes to Checked Out.
- `lifecycleStatus: "needs_service"` contributes to Service.
- Other statuses contribute to Other.

Duplicate serial numbers are reported as grouping risks and are not automatically merged.

## Non-Serialized Rules

Items without `serial`, `assetTag`, or `assetNumber` are treated as quantity inventory. Quantity inventory is grouped under its product by `locationName` and `lotNumber`.

Quantity products show:

- total quantity
- available quantity
- location quantity
- lot number when present
- underlying inventory records for existing actions

No fake serial rows are generated for consumables or supplies.

## Search Behavior

Existing inventory search remains upstream in `useInventoryFilters`, so the index receives only records that match the current search and filters. The index also builds normalized search metadata at category, product, and unit levels so future tree-specific search can match category names, product names, manufacturers, models, SKUs, HCPCS codes, serials, asset IDs, locations, and existing `searchText`.

Searching for a serial, model, manufacturer, category, SKU, or HCPCS value continues to use the existing global filter path and then displays the reduced matching hierarchy.

## UI Navigation Structure

The inventory table now renders as a collapsible directory:

- categories are visible by default with summary counts
- products render only when a category is expanded
- serial or quantity detail rows render only when a product is expanded
- selecting a serial or quantity record calls the existing item edit path
- row actions call the existing edit, discontinue, archive, and permanent delete callbacks

This replaces the prior flat default list of every individual serialized asset.

## Legacy Data Risks

The index reports safe cleanup risks without writing data:

- missing category
- missing stable product identity fields
- duplicate serial identifiers

Other known legacy risks from the current schema include inconsistent product names, missing manufacturer/model values, serials stored in multiple fields, and quantity supplies that may have barcodes but no serialized asset identifier.

## Uncategorized Strategy

No inventory item disappears because metadata is incomplete. Missing categories are inferred from existing aliases when possible. If no category can be inferred, the item appears under:

```text
Uncategorized
    Unknown Product
        quantity row or serialized unit
```

The UI remains read-only with respect to cleanup. Cleanup can be handled later by product/category maintenance workflows.

## Performance Strategy

The index builder performs single-pass grouping with `Map` structures and deterministic sort passes at the end. React calls the builder through `useMemo`, so grouping is recalculated only when the filtered item array changes.

The tree avoids rendering the full serialized inventory DOM by keeping product/unit details collapsed until requested.

## Migration Considerations

No database migration is required for this implementation. The hierarchy is derived from existing records, and no inventory quantities, serialized states, products, or category fields are changed.

Future migrations should be explicit and validated separately if the business decides to normalize product category IDs or merge legacy product records.

## Example Inventory Trees

```text
Oxygen Equipment
    O2 Concentrator
        Invacare Perfecto
            SN#123456789
            SN#987654321

Mobility
    Wheelchair
        Drive Cruiser III
            SN#WC001
            SN#WC002

Supplies
    Nasal Cannula 7 ft
        Main Warehouse: 30
        Hopkinsville: 12

Uncategorized
    Unknown Product
        Main Warehouse: 1
```

## Data Quality / Grouping Risk Diagnostics

The inventory page includes a read-only Data Quality panel for admins and staff who need to understand why the hierarchy may group legacy records imperfectly. The panel analyzes the currently loaded inventory records in memory. It does not write to Firestore, update products, merge inventory, change stock, or alter serialized asset state.

The diagnostics use the same index classification helpers as the browser:

- category resolution from explicit category, inferred aliases, or `Uncategorized`
- product grouping from `productId`, then manufacturer/model/SKU/HCPCS/name fallback
- serialized identity from `serial`, `assetTag`, or `assetNumber`
- quantity grouping from `locationName` and `lotNumber`

## Risk Categories

Canonical grouping risk categories:

- `MISSING_CATEGORY`
- `MISSING_PRODUCT_ID`
- `WEAK_PRODUCT_IDENTITY`
- `UNCATEGORIZED`
- `DUPLICATE_SERIAL`
- `DUPLICATE_ASSET_TAG`
- `DUPLICATE_ASSET_NUMBER`
- `POSSIBLE_DUPLICATE_PRODUCT`
- `INCONSISTENT_MANUFACTURER`
- `INCONSISTENT_MODEL`
- `INCONSISTENT_PRODUCT_NAME`
- `MISSING_SERIAL_FOR_SERIALIZED_ITEM`
- `MULTIPLE_PRODUCT_IDS_FOR_SAME_MODEL`
- `SAME_PRODUCT_ID_DIFFERENT_MODEL`
- `INVALID_QUANTITY_METADATA`
- `UNKNOWN`

The analyzer only emits risks it can detect from current `InventoryItem` fields. It does not use fuzzy matching and does not infer duplicates from product display name alone.

## Severity Rules

Severity is assigned conservatively:

- `CRITICAL`: duplicate active serial, asset tag, or asset number identifiers.
- `HIGH`: product ID conflicts, likely product splits across stable manufacturer/model/SKU evidence, or serialized records missing all serial/asset identifiers.
- `MEDIUM`: missing category, missing product ID, weak fallback identity, Uncategorized, inconsistent product naming, or invalid quantity metadata.
- `LOW`: reserved for future harmless formatting-only diagnostics.

False positives are intentionally minimized. Ambiguous display-name similarities are left unflagged unless stable identity fields support the finding.

## Grouping-Risk Logic

The analyzer performs a single pass over inventory records and builds maps for:

- serial identifiers
- asset tags
- asset numbers
- product IDs
- manufacturer/model identity
- SKU
- HCPCS/manufacturer/model identity
- hierarchy product grouping keys

It then emits deterministic, sorted risks with record IDs, non-PHI identifiers, current category, product grouping key, severity, confidence, and a manual cleanup recommendation.

## Admin Workflow

The Data Quality panel is available from the inventory page alongside Browse. It shows summary cards for critical, high, medium, Uncategorized, duplicate serial, and weak identity counts.

Admins can filter by:

- severity
- risk type
- category
- product
- location
- serialized or quantity inventory
- text search

Each risk row can open an affected inventory record through the existing inventory edit/detail workflow. Admin users also get protected cleanup controls for metadata-only corrections. Staff users keep read-only diagnostics.

## Protected Cleanup Workflow

The protected cleanup path is implemented by `inventoryCleanupWorkflowCallable` in `functions/src/inventory/cleanupWorkflow.ts`. The callable is intentionally admin-only; staff, tank, disabled, deleted, and unauthenticated users are rejected before preview or apply.

Cleanup is a two-step workflow:

- `preview` reads the current inventory record, validates the requested action, returns the proposed diff, warnings, side effects, and a preview token.
- `apply` requires the preview token, recomputes the preview inside the authoritative server path, verifies the record has not changed, writes the metadata correction transactionally, records idempotency, and writes audit.

Supported cleanup actions are restricted to grouping and identity metadata:

- assign category
- link or relink a canonical product
- correct manufacturer, model, product name, serial, asset tag, or asset number
- mark a risk reviewed
- dismiss a false positive

The workflow does not create inventory movements, change `quantityOnHand`, change availability/rental counts, edit rental state, edit patient-equipment assignments, delete or merge records, or perform bulk automatic cleanup. Duplicate serialized identifiers are blocked when another active inventory record already uses the requested serial, asset tag, or asset number.

`MARK_AS_REVIEWED` and `DISMISS_FALSE_POSITIVE` write review metadata to `inventoryGroupingRiskReviews` instead of mutating the inventory record. Successful apply calls write an `auditLogs` entry with the operation ID, cleanup action, old values, new values, reason, and target identifiers.

## Export Behavior

The panel exports the filtered risk report to CSV using existing browser APIs. Export columns avoid PHI and include risk, severity, category, product, manufacturer, model, product ID, inventory item ID, identifiers, location, and recommendation.

## Limitations

The diagnostics are limited to records currently loaded by the inventory page. They do not query historical movement data, patient equipment assignments, product catalog documents, or deleted records outside the current inventory subscription.

Serialized-item missing-identifier detection is conservative. A quantity supply without a serial is not a risk. A record is treated as likely serialized when active rental or patient/equipment metadata indicates a physical assigned asset but no serial, asset tag, or asset number is present.

## Manual Cleanup Rationale

Fixes remain intentionally manual because grouping issues can represent real operational ambiguity. Duplicate serials, split product IDs, and conflicting product metadata require human verification before any relink or category update. Destructive cleanup such as product merges, inventory deletion, duplicate asset merges, rental relinks, and patient-equipment relinks remains unsupported by this workflow and must be designed as separate validated server workflows if needed.
