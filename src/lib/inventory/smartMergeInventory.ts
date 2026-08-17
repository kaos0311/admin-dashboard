import { httpsCallable } from "firebase/functions";

import { functions } from "@/lib/firebase";

export type SmartMergeInventoryInput = {
  operationId: string;
  inventoryItemId?: string;
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
  expirationDate?: string;
  locationName?: string;
  binLocation?: string;
  reorderLevel?: number;
  unitCost?: number;
  notes?: string;
  source?: string;
  sourceId?: string;
};

export type SmartMergeAmbiguousMatch = {
  inventoryItemId: string;
  matchedBy: string[];
  name: string;
  barcode: string;
  serial: string;
  lotNumber: string;
  sku: string;
};

export type SmartMergeResult = {
  action: "created" | "merged";
  status: "created" | "merged" | "duplicate_operation";
  inventoryId: string;
};

export type SmartMergeAmbiguousResult = {
  status: "ambiguous";
  matches: SmartMergeAmbiguousMatch[];
};

type ManualInventoryUpsertResult =
  | {
      status: "created";
      inventoryItemId: string;
    }
  | {
      status: "merged";
      inventoryItemId: string;
    }
  | {
      status: "duplicate_operation";
      action: "created" | "merged";
      inventoryItemId: string;
    }
  | SmartMergeAmbiguousResult;

export async function smartMergeInventory(
  input: SmartMergeInventoryInput,
): Promise<SmartMergeResult | SmartMergeAmbiguousResult> {
  const callable = httpsCallable<
    SmartMergeInventoryInput,
    ManualInventoryUpsertResult
  >(functions, "manualInventoryUpsertCallable");

  const result = await callable(input);
  const data = result.data;

  if (data.status === "ambiguous") {
    return data;
  }

  if (data.status === "duplicate_operation") {
    return {
      status: data.status,
      action: data.action,
      inventoryId: data.inventoryItemId,
    };
  }

  return {
    status: data.status,
    action: data.status,
    inventoryId: data.inventoryItemId,
  };
}
