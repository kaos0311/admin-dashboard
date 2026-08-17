import type { ManualInventoryMetadataUpdateInput } from "@/lib/inventory/manualInventoryMetadataUpdate";

import type { InventoryItem } from "./inventoryTypes";

export function buildExistingInventoryMetadataUpdateRequest(params: {
  operationId: string;
  inventoryItemId: string;
  payload: Omit<InventoryItem, "id" | "searchText" | "isDeleted">;
  productId: string;
  searchText: string;
  pendingScanReview: boolean;
  scanSource: string;
  lowStock: boolean;
}): ManualInventoryMetadataUpdateInput {
  return {
    operationId: params.operationId,
    inventoryItemId: params.inventoryItemId,
    productId: params.productId,
    name: params.payload.name,
    category: params.payload.category,
    manufacturer: params.payload.manufacturer,
    manufacturerItemId: params.payload.manufacturerItemId,
    sku: params.payload.sku,
    hcpc: params.payload.hcpc,
    barcode: params.payload.barcode,
    serial: params.payload.serial,
    lotNumber: params.payload.lotNumber,
    reorderLevel: params.payload.reorderLevel,
    unitCost: params.payload.unitCost,
    modelNumber: params.payload.modelNumber,
    warrantyProvider: params.payload.warrantyProvider,
    warrantyStartDate: params.payload.warrantyStartDate,
    warrantyEndDate: params.payload.warrantyEndDate,
    warrantyNotes: params.payload.warrantyNotes,
    purchaseDate: params.payload.purchaseDate,
    usefulLifeMonths: params.payload.usefulLifeMonths,
    nextServiceDate: params.payload.nextServiceDate,
    lifecycleNotes: params.payload.lifecycleNotes,
    notes: params.payload.notes,
    searchText: params.searchText,
    pendingScanReview: params.pendingScanReview,
    scanSource: params.scanSource,
    lowStock: params.lowStock,
  };
}
