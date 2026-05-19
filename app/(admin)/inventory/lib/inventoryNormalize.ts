import type {
  InventoryItem,
  InventoryStatus,
  LifecycleStatus,
} from "./inventoryTypes";

export function toSafeString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function toSafeNumber(value: unknown): number {
  if (value === "" || value == null || value === "-") return 0;

  const parsed = Number(String(value).replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

export function formatMoney(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export function buildSearchText(
  item: Omit<InventoryItem, "id" | "isDeleted" | "searchText">
): string {
  return normalizeSearchText(
    [
      item.name,
      item.category,
      item.sku,
      item.barcode,
      item.serial,
      item.lotNumber,
      item.locationName,
      item.binLocation,
      item.status,
      item.manufacturer,
      item.manufacturerItemId,
      item.modelNumber,
      item.warrantyProvider,
      item.lifecycleStatus,
      item.notes,
      item.lifecycleNotes,
    ].join(" ")
  );
}

export function normalizeInventoryItem(
  id: string,
  data: Record<string, unknown>
): InventoryItem {
  const quantityOnHand = toSafeNumber(data.quantityOnHand);
  const committed = toSafeNumber(data.committed);
  const onRent = toSafeNumber(data.onRent);
  const onOrder = toSafeNumber(data.onOrder);
  const unitCost = toSafeNumber(data.unitCost);

  const available =
    data.available == null
      ? quantityOnHand - committed - onRent
      : toSafeNumber(data.available);

  const rawStatus = toSafeString(data.status);

  const status: InventoryStatus =
    rawStatus === "inactive" ||
    rawStatus === "damaged" ||
    rawStatus === "lost" ||
    rawStatus === "discontinued"
      ? rawStatus
      : "available";

  const rawLifecycle = toSafeString(data.lifecycleStatus);

  const lifecycleStatus: LifecycleStatus =
    rawLifecycle === "new" ||
    rawLifecycle === "needs_service" ||
    rawLifecycle === "end_of_life" ||
    rawLifecycle === "retired"
      ? rawLifecycle
      : "active";

  const itemWithoutSearch = {
    productId: toSafeString(data.productId),
    name: toSafeString(data.name),
    category: toSafeString(data.category),
    sku: toSafeString(data.sku),
    barcode: toSafeString(data.barcode),
    serial: toSafeString(data.serial),
    lotNumber: toSafeString(data.lotNumber),
    locationName: toSafeString(data.locationName) || "Main Location",
    binLocation: toSafeString(data.binLocation),
    quantityOnHand,
    committed,
    onRent,
    onOrder,
    available,
    reorderLevel: toSafeNumber(data.reorderLevel),
    unitCost,
    totalValue:
      data.totalValue == null
        ? quantityOnHand * unitCost
        : toSafeNumber(data.totalValue),
    status,
    manufacturer: toSafeString(data.manufacturer),
    manufacturerItemId: toSafeString(data.manufacturerItemId),
    modelNumber: toSafeString(data.modelNumber),
    warrantyProvider: toSafeString(data.warrantyProvider),
    warrantyStartDate: toSafeString(data.warrantyStartDate),
    warrantyEndDate: toSafeString(data.warrantyEndDate),
    warrantyNotes: toSafeString(data.warrantyNotes),
    purchaseDate: toSafeString(data.purchaseDate),
    usefulLifeMonths: toSafeNumber(data.usefulLifeMonths),
    lifecycleStatus,
    nextServiceDate: toSafeString(data.nextServiceDate),
    lifecycleNotes: toSafeString(data.lifecycleNotes),
    notes: toSafeString(data.notes),
  };

  return {
    id,
    ...itemWithoutSearch,
    searchText:
      toSafeString(data.searchText) || buildSearchText(itemWithoutSearch),
    isDeleted: data.isDeleted === true,
  };
}