import type { InventoryItem, MovementPayload } from "@/app/(admin)/inventory/lib/inventoryTypes";
import type { RentalRecord } from "@/app/(admin)/rentals/rentals-types";

/**
 * Firestore document shape for the "products" collection (minimal fields used).
 */
export interface ProductDocument {
  id: string;
  name: string;
  category: string;
  sku: string;
  hcpcs: string;
  upc: string;
  manufacturer: string;
  brand: string;
  manufacturerItemId: string;
  model: string;
  defaultPurchasePrice: number;
  reorderLevel: number;
  status: string;
  deleted: boolean;
  [key: string]: unknown;
}

/**
 * Firestore document shape for the "settings/app" inventory thresholds.
 */
export interface SettingsInventoryThresholds {
  defaultReorderLevel: number;
  cpapSupplyReorderLevel: number;
  oxygenReorderLevel: number;
  rentalEquipmentReorderLevel: number;
  highDemandReorderLevel: number;
  lowStockWarningEnabled: boolean;
}

/**
 * Stock movement input — extends MovementPayload with server-side fields.
 */
export type StockMovementInput = MovementPayload & {
  source: string;
  createdAt: ReturnType<typeof import("firebase/firestore").serverTimestamp>;
};

/**
 * Input for batch-updating multiple inventory documents.
 */
export interface InventoryBatchUpdate {
  id: string;
  data: Record<string, unknown>;
}

/**
 * Subscription callback types.
 */
export type InventorySubscriptionCallback = (items: InventoryItem[]) => void;
export type InventoryItemSubscriptionCallback = (item: InventoryItem | null) => void;
export type SettingsSubscriptionCallback = (thresholds: SettingsInventoryThresholds) => void;
export type PatientSubscriptionCallback = (patients: Array<{ id: string; data: Record<string, unknown> }>) => void;
export type ErrorCallback = (error: unknown) => void;
