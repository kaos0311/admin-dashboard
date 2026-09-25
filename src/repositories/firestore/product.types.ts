import type { Product } from "@/app/(admin)/products/utils/productTypes";

// ---------------------------------------------------------------------------
// Recall & Equipment schemas (Firestore document shapes)
// ---------------------------------------------------------------------------

export interface RecallSettings {
  internetScanEnabled: boolean;
  scanNewProductsEnabled: boolean;
  discontinuedScanEnabled: boolean;
  scanNewDiscontinuedProductsEnabled: boolean;
}

export interface RecallMatchItem {
  id: string;
  productId: string;
  productName: string;
  recallTitle: string;
  manufacturer: string;
  model: string;
  severity: string;
  status: string;
  actionRequired: string;
  sourceUrl: string;
}

export interface EquipmentRecallItem {
  id: string;
  recallTitle: string;
  manufacturer: string;
  model: string;
  severity: string;
  actionRequired: string;
  sourceUrl: string;
}

// ---------------------------------------------------------------------------
// Callback types
// ---------------------------------------------------------------------------

export type RecallSettingsCallback = (settings: RecallSettings) => void;
export type RecallMatchesCallback = (matches: RecallMatchItem[]) => void;
export type EquipmentRecallsCallback = (recalls: EquipmentRecallItem[]) => void;
export type ErrorCallbackType = (error: unknown) => void;
