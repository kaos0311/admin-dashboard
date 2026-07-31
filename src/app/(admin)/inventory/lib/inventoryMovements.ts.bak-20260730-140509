import { InventoryRepository } from "@/repositories/firestore/inventory.repository";

import type { MovementPayload } from "./inventoryTypes";

export async function logInventoryMovement(payload: MovementPayload) {
  await InventoryRepository.recordMovement({
    productId: payload.productId,
    productName: payload.productName,
    barcode: payload.barcode,
    serial: payload.serial,
    lotNumber: payload.lotNumber,
    type: payload.type,
    quantity: payload.quantity,
    sourceId: payload.sourceId,
    notes: payload.notes,
    affectedIds: payload.affectedIds,
  });
}
