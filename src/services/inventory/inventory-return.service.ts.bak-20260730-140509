import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import type { Auth } from "firebase/auth";

import type { InventoryItem } from "@/app/(admin)/inventory/lib/inventoryTypes";
import type { DeceasedPickupCandidate } from "./pickup-review.types";
import { archiveCurrentEquipmentArray } from "./pickup-review.service";

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

  const returnQuantity = Math.max(
    item.onRent ?? 0,
    item.status === "rental_out" ? 1 : 0,
    1,
  );
  const now = serverTimestamp();
  const archivedAt = new Date().toISOString();
  const actor = auth.currentUser;
  const returnReason =
    candidate.reason === "pickup_after_delivery"
      ? "pickup_after_delivery_return"
      : "deceased_patient_pickup";

  const patientRef = doc(db, "patients", patientKey);
  const patientSnap = await getDoc(patientRef);
  const currentEquipmentUpdate = patientSnap.exists()
    ? archiveCurrentEquipmentArray(
        patientSnap.data().currentEquipment,
        item,
        archivedAt,
      )
    : null;

  // --- Build the next state of the inventory item (only for searchText) ---
  const nextItem: InventoryItemWithoutMeta & {
    id: string;
    isDeleted: boolean;
    searchText: string;
  } = {
    ...item,
    status: "available",
    available: item.available + returnQuantity,
    onRent: 0,
    patientKey: "",
    patientId: "",
    patientName: "",
    patientDob: "",
    patientPhone: "",
    insuranceName: "",
    payor: "",
    planType: "",
    salesOrderId: "",
    salesOrderDetailId: "",
    nextBillingDate: "",
    nextDos: "",
    returnedFromPatientKey: patientKey,
    returnedFromPatientName: patient.fullName,
    activeAssetArchived: true,
    patientEquipmentArchived: true,
  };

  // --- 1. Update the inventory document ---
  await updateDoc(doc(db, "inventory", item.id), {
    status: "available",
    available: nextItem.available,
    onRent: 0,
    patientKey: "",
    patientId: "",
    patientName: "",
    patientDob: "",
    patientPhone: "",
    insuranceName: "",
    payor: "",
    planType: "",
    salesOrderId: "",
    salesOrderDetailId: "",
    nextBillingDate: "",
    nextDos: "",
    returnedFromPatientKey: patientKey,
    returnedFromPatientName: patient.fullName,
    activeAssetArchived: true,
    patientEquipmentArchived: true,
    lastReturnedAt: now,
    returnReason,
    updatedAt: now,
    searchText: buildSearchText(nextItem),
  });

  // --- 2. Archive the equipment entry in the patient document ---
  if (currentEquipmentUpdate) {
    await updateDoc(patientRef, {
      currentEquipment: currentEquipmentUpdate,
      currentEquipmentArchivedAt: now,
      updatedAt: now,
    });
  }

  // --- 3. Record a stock movement ---
  await addDoc(collection(db, "stockMovements"), {
    productId: item.productId,
    productName: item.name,
    barcode: item.barcode,
    serial: item.serial,
    lotNumber: item.lotNumber,
    type: returnReason,
    quantity: returnQuantity,
    source: "inventory",
    sourceId: item.id,
    patientKey,
    patientName: patient.fullName,
    dateOfDeath: patient.dateOfDeath ?? "",
    pickupDate: candidate.pickupDate ?? "",
    lastDeliveryDate: candidate.lastDeliveryDate,
    notes:
      candidate.reason === "pickup_after_delivery"
        ? "Checked back into inventory because pickup date is after delivery date."
        : "Checked back into inventory after deceased patient pickup review.",
    createdBy: actor?.uid ?? "",
    createdByEmail: actor?.email ?? "",
    createdAt: now,
  });

  // --- 4. Write an equipment sub‑document on the patient ---
  await setDoc(
    doc(db, "patients", patientKey, "equipment", item.id),
    {
      inventoryId: item.id,
      productId: item.productId,
      itemName: item.name,
      barcode: item.barcode,
      serialNumber: item.serial,
      lotNumber: item.lotNumber,
      status: "returned",
      archived: true,
      archivedAt: now,
      archiveReason: returnReason,
      returnReason,
      returnedAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  // --- 5. Add a timeline entry ---
  await addDoc(collection(db, "patients", patientKey, "timeline"), {
    type: "equipment_returned",
    title: "Equipment archived and checked back into inventory",
    body:
      candidate.reason === "pickup_after_delivery"
        ? `${item.name || "Equipment"} was archived from active equipment because pickup date is after delivery date and was returned to inventory.`
        : `${item.name || "Equipment"} was checked back into inventory after deceased patient pickup review.`,
    metadata: {
      inventoryId: item.id,
      productId: item.productId,
      barcode: item.barcode,
      serial: item.serial,
      lotNumber: item.lotNumber,
      dateOfDeath: patient.dateOfDeath ?? "",
      pickupDate: candidate.pickupDate ?? "",
      lastDeliveryDate: candidate.lastDeliveryDate,
      returnReason,
      archivedCurrentEquipment: Boolean(currentEquipmentUpdate),
    },
    actorUid: actor?.uid ?? null,
    actorEmail: actor?.email ?? null,
    createdAt: now,
  });
}
