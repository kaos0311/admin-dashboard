import { FieldValue } from "firebase-admin/firestore";
import type { ImportRow } from "../../types/stagingChunk";
import type { BulkSetInput } from "../../utils/bulkWriter";
import { safeFirestoreId } from "../../utils/hash";
import {
  clean,
  normalize,
  normalizeStatus,
  read,
  toBoolean,
  toDateString,
  toNumber,
} from "./shopRowUtils";

export function itemDetailWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const itemId = read(row, ["ItemID"]);
  if (!itemId) return [];
  const productId = safeFirestoreId(itemId, "product");
  const data = clean({
    sku: itemId,
    itemId,
    name: read(row, ["itemname", "ItemName"]),
    description: read(row, ["Descr"]),
    isLotted: toBoolean(read(row, ["Lotted"])),
    itemType: read(row, ["itemtype"]),
    category: read(row, ["itemgroup"]),
    glGroup: read(row, ["glgroup"]),
    salesType: read(row, ["salestype"]),
    status: normalizeStatus(read(row, ["itemstatus"])),
    autoReorder: toBoolean(read(row, ["AutoReorder"])),
    manufacturer: read(row, ["manf"]),
    manufacturerItemId: read(row, ["ManfItemID"]),
    upc: read(row, ["UPC"]),
    stockingUom: read(row, ["StockingUOM"]),
    stockingUomAbbreviation: read(row, ["StockingUOMAbbreviation"]),
    isSerialized: false,
    source: "adhoc_item_detail",
    lastImportId: importId,
  });

  return [
    { path: "products", id: productId, data },
    { path: "shopItems", id: productId, data },
  ];
}

export function lotNumberWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const itemId = read(row, ["ItemID"]);
  const lotNumber = read(row, ["LotNumber"]);
  const location = read(row, ["LocationName"]);
  if (!itemId && !lotNumber) return [];
  const id = safeFirestoreId(`${itemId}-${location}-${lotNumber}`, "lot");
  const data = clean({
    itemId,
    sku: itemId,
    name: read(row, ["ItemName"]),
    locationName: location,
    upc: read(row, ["UPC"]),
    manufacturerItemId: read(row, ["ManufacturerItemID"]),
    itemType: read(row, ["ItemType"]),
    category: read(row, ["ItemGroupName"]),
    onHandQty: toNumber(read(row, ["OnHandQty"])),
    onRentQty: toNumber(read(row, ["OnRentQty"])),
    onOrderQty: toNumber(read(row, ["OnOrderQty"])),
    availableQty: toNumber(read(row, ["AvailableQty"])),
    committedQty: toNumber(read(row, ["CommittedQty"])),
    status: normalizeStatus(read(row, ["ItemStatus"])),
    lotNumber,
    expirationDate: toDateString(read(row, ["ExpirationDate"])),
    source: "adhoc_lot_numbers",
    lastImportId: importId,
  });

  return [
    { path: "inventory", id, data },
    { path: "shopInventoryLots", id, data },
  ];
}

export function serialAvailabilityWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const serial = read(row, ["SerialNbr"]);
  const itemId = read(row, ["ItemID"]);
  const location = read(row, ["Name"]);
  if (!serial && !itemId) return [];
  const id = safeFirestoreId(`${itemId}-${serial}-${location}`, "serial");
  const data = clean({
    serial,
    serialNumber: serial,
    itemId,
    sku: itemId,
    name: read(row, ["ItemName"]),
    locationName: location,
    availableQty: toNumber(read(row, ["AvailQty"])),
    onRentQty: toNumber(read(row, ["OnRentQty"])),
    soldDate: toDateString(read(row, ["DtSold"])),
    status: toNumber(read(row, ["OnRentQty"])) > 0 ? "rented" : "available",
    isSerialized: true,
    source: "adhoc_serial_number_availability",
    lastImportId: importId,
  });

  return [
    { path: "inventory", id, data },
    { path: "shopInventorySerials", id, data },
  ];
}

export function hcpcsCodeWrites(
  code: string,
  description: string,
  importId: string,
  source: string
): BulkSetInput[] {
  const normalizedCode = normalize(code).toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z]\d{4}[A-Z0-9]{0,2}$/.test(normalizedCode)) return [];

  return [
    {
      path: "hcpcsCodes",
      id: safeFirestoreId(normalizedCode, "hcpcs"),
      data: clean({
        code: normalizedCode,
        description,
        category: "DME/HME",
        source,
        lastImportId: importId,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    },
  ];
}
