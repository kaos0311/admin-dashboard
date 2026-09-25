import { httpsCallable } from "firebase/functions";

import { functions } from "@/lib/firebase";

export type ManualInventoryMetadataUpdateInput = {
  operationId: string;
  inventoryItemId: string;
  productId?: string;
  name: string;
  category: string;
  manufacturer?: string;
  manufacturerItemId?: string;
  sku?: string;
  hcpc?: string;
  barcode?: string;
  serial?: string;
  lotNumber?: string;
  reorderLevel?: number;
  unitCost?: number;
  modelNumber?: string;
  warrantyProvider?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyNotes?: string;
  purchaseDate?: string;
  usefulLifeMonths?: number;
  nextServiceDate?: string;
  lifecycleNotes?: string;
  notes?: string;
  searchText?: string;
  pendingScanReview?: boolean;
  scanSource?: string;
  lowStock?: boolean;
};

export type ManualInventoryMetadataUpdateResult =
  | {
      status: "success";
      inventoryItemId: string;
    }
  | {
      status: "duplicate_operation";
      inventoryItemId: string;
    };

export async function updateManualInventoryMetadata(
  input: ManualInventoryMetadataUpdateInput,
): Promise<ManualInventoryMetadataUpdateResult> {
  const callable = httpsCallable<
    ManualInventoryMetadataUpdateInput,
    ManualInventoryMetadataUpdateResult
  >(functions, "manualInventoryMetadataUpdateCallable");

  const result = await callable(input);
  return result.data;
}
