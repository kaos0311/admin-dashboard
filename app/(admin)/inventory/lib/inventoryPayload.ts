import type { InventoryItem } from "./inventoryTypes";
import { buildSearchText, toSafeNumber, toSafeString } from "./inventoryUtils";

type InventoryPayloadInput = Partial<InventoryItem>;

type InventoryPayload = Omit<InventoryItem, "id" | "isDeleted" | "searchText"> & {
  searchText: string;
  isDeleted: boolean;
};

export function buildInventoryPayload(input: InventoryPayloadInput): InventoryPayload {
  const quantityOnHand = toSafeNumber(input.quantityOnHand);
  const committed = toSafeNumber(input.committed);
  const onRent = toSafeNumber(input.onRent);
  const onOrder = toSafeNumber(input.onOrder);
  const unitCost = toSafeNumber(input.unitCost);

  const itemWithoutSearch = {
    productId: toSafeString(input.productId),
    name: toSafeString(input.name),
    category: toSafeString(input.category),
    sku: toSafeString(input.sku),
    barcode: toSafeString(input.barcode),
    serial: toSafeString(input.serial),
    lotNumber: toSafeString(input.lotNumber),
    locationName: toSafeString(input.locationName) || "Main Location",
    binLocation: toSafeString(input.binLocation),
    quantityOnHand,
    committed,
    onRent,
    onOrder,
    available:
      input.available === null || input.available === undefined
        ? quantityOnHand - committed - onRent
        : toSafeNumber(input.available),
    reorderLevel: toSafeNumber(input.reorderLevel),
    unitCost,
    totalValue:
      input.totalValue === null || input.totalValue === undefined
        ? quantityOnHand * unitCost
        : toSafeNumber(input.totalValue),
    status: input.status ?? "available",
    manufacturer: toSafeString(input.manufacturer),
    manufacturerItemId: toSafeString(input.manufacturerItemId),
    modelNumber: toSafeString(input.modelNumber),
    warrantyProvider: toSafeString(input.warrantyProvider),
    warrantyStartDate: toSafeString(input.warrantyStartDate),
    warrantyEndDate: toSafeString(input.warrantyEndDate),
    warrantyNotes: toSafeString(input.warrantyNotes),
    purchaseDate: toSafeString(input.purchaseDate),
    usefulLifeMonths: toSafeNumber(input.usefulLifeMonths),
    lifecycleStatus: input.lifecycleStatus ?? "active",
    nextServiceDate: toSafeString(input.nextServiceDate),
    lifecycleNotes: toSafeString(input.lifecycleNotes),
    notes: toSafeString(input.notes),
  };

  return {
    ...itemWithoutSearch,
    searchText: buildSearchText(itemWithoutSearch),
    isDeleted: input.isDeleted === true,
  };
}
