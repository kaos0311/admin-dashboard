import type {
  InventoryItem,
  InventoryStatus,
  LifecycleStatus,
} from "./inventoryTypes";

type InventoryItemWithoutMeta = Omit<
  InventoryItem,
  "id" | "isDeleted" | "searchText"
>;

const VALID_INVENTORY_STATUSES = new Set<InventoryStatus>([
  "available",
  "inactive",
  "damaged",
  "lost",
  "discontinued",
]);

const VALID_LIFECYCLE_STATUSES = new Set<LifecycleStatus>([
  "active",
  "new",
  "needs_service",
  "end_of_life",
  "retired",
]);

export function toSafeString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

export function toSafeNumber(value: unknown): number {
  if (value === "" || value === null || value === undefined || value === "-") {
    return 0;
  }

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

export function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) {
    return [Array.from(items)];
  }

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export function buildSearchText(item: InventoryItemWithoutMeta): string {
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

function normalizeInventoryStatus(value: unknown): InventoryStatus {
  const status = toSafeString(value) as InventoryStatus;

  return VALID_INVENTORY_STATUSES.has(status) ? status : "available";
}

function normalizeLifecycleStatus(value: unknown): LifecycleStatus {
  const lifecycleStatus = toSafeString(value) as LifecycleStatus;

  return VALID_LIFECYCLE_STATUSES.has(lifecycleStatus)
    ? lifecycleStatus
    : "active";
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
    data.available === null || data.available === undefined
      ? quantityOnHand - committed - onRent
      : toSafeNumber(data.available);

  const totalValue =
    data.totalValue === null || data.totalValue === undefined
      ? quantityOnHand * unitCost
      : toSafeNumber(data.totalValue);

  const itemWithoutSearch: InventoryItemWithoutMeta = {
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
    totalValue,
    status: normalizeInventoryStatus(data.status),
    manufacturer: toSafeString(data.manufacturer),
    manufacturerItemId: toSafeString(data.manufacturerItemId),
    modelNumber: toSafeString(data.modelNumber),
    warrantyProvider: toSafeString(data.warrantyProvider),
    warrantyStartDate: toSafeString(data.warrantyStartDate),
    warrantyEndDate: toSafeString(data.warrantyEndDate),
    warrantyNotes: toSafeString(data.warrantyNotes),
    purchaseDate: toSafeString(data.purchaseDate),
    usefulLifeMonths: toSafeNumber(data.usefulLifeMonths),
    lifecycleStatus: normalizeLifecycleStatus(data.lifecycleStatus),
    nextServiceDate: toSafeString(data.nextServiceDate),
    lifecycleNotes: toSafeString(data.lifecycleNotes),
    notes: toSafeString(data.notes),
  };

  return {
    id,
    ...itemWithoutSearch,
    searchText: toSafeString(data.searchText) || buildSearchText(itemWithoutSearch),
    isDeleted: data.isDeleted === true,
  };
}


