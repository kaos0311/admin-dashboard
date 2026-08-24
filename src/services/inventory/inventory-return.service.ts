import type { Firestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";

import type { InventoryItem } from "@/app/(admin)/inventory/lib/inventoryTypes";
import { createInventoryMovement } from "@/lib/inventory/movements";
import type { DeceasedPickupCandidate } from "./pickup-review.types";

type InventoryItemWithoutMeta = Omit<InventoryItem, "id" | "isDeleted" | "searchText">;

/**
 * Checks a deceased-patient / pickup-after-delivery item back into available
 * inventory. Performs all Firestore writes — inventory document, patient
 * equipment archive, stock movement, equipment sub‑doc, and timeline entry.
 *
 * @returns Resolves when all writes complete.
 * @throws If any write fails or the actor is missing.
 */
export async function checkInDeceasedPickup(
  candidate: DeceasedPickupCandidate,
  db: Firestore,
  auth: Auth,
  buildSearchText: (item: InventoryItemWithoutMeta) => string,
): Promise<void> {
  const { item, patient } = candidate;
  const patientKey = item.patientKey || item.patientId || patient.id;
  const actor = auth.currentUser;
  const returnQuantity = Math.max(
    item.onRent ?? 0,
    item.status === "rental_out" ? 1 : 0,
    1,
  );
  const returnReason =
    candidate.reason === "pickup_after_delivery"
      ? "pickup_after_delivery_return"
      : "deceased_patient_pickup";

  if (!actor) {
    throw new Error("You must be signed in to return equipment.");
  }

  const result = await createInventoryMovement({
    operationId: `deceased-return-${item.id}-${Date.now()}`,
    movementType: "deceased_patient_equipment_return",
    inventoryItemId: item.id,
    productId: item.productId,
    barcode: item.barcode,
    serialNumber: item.serial,
    lotNumber: item.lotNumber,
    quantity: returnQuantity,
    patientId: patientKey,
    patientName: patient.fullName,
    reason: returnReason,
    source: "deceased_pickup",
    metadata: {
      dateOfDeath: patient.dateOfDeath ?? "",
      pickupDate: candidate.pickupDate ?? "",
      lastDeliveryDate: candidate.lastDeliveryDate,
      actorUid: actor.uid,
      actorEmail: actor.email,
    },
  });

  if (result.status !== "success" && result.status !== "duplicate_operation") {
    throw new Error(result.message || "Could not check equipment back into inventory.");
  }

  void db;
  void buildSearchText;
}
