/**
 * Typed wrapper request and response shapes for the scanned inventory intake flow.
 */

export type ReceiveScannedInventoryIntakeMode = "product-match" | "pending-scan";

export interface ReceiveScannedInventoryIntakeRequest {
  operationId?: string;
  mode: ReceiveScannedInventoryIntakeMode;
  rawScan: string;
  normalizedScan: string;
  quantity: number;
  locationId?: string;
  productId?: string;
}

export interface ReceiveScannedInventoryIntakeSuccess {
  status: "success";
  inventoryItemId: string;
  movementId: string;
  quantityBefore: number;
  quantityChange: number;
  quantityAfter: number;
  createdOrMerged: "created" | "merged";
  mode: ReceiveScannedInventoryIntakeMode;
}

export type ReceiveScannedInventoryIntakeResult = ReceiveScannedInventoryIntakeSuccess;

export interface ReceiveScannedInventoryIntakeCallableSuccess {
  ok: true;
  data: ReceiveScannedInventoryIntakeResult;
}

export interface ReceiveScannedInventoryIntakeCallableError {
  ok: false;
  code: string;
  message: string;
}

export type ReceiveScannedInventoryIntakeResponse =
  | ReceiveScannedInventoryIntakeCallableSuccess
  | ReceiveScannedInventoryIntakeCallableError;
