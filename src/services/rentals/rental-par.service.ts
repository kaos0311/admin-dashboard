import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

import { isRentalParExpired } from "@/app/(admin)/rentals/utils/calculations";

import type { RentalRecord } from "@/app/(admin)/rentals/rentals-types";

export const PAR_SYNC_WINDOW_DAYS = 30;

function rentalPatientKey(record: RentalRecord): string {
  return record.patientId || record.patientName || "";
}

function rentalParSyncKey(record: RentalRecord): string {
  return [record.id, record.parNumber, record.parExpiration].join("|");
}

function rentalParNumber(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function buildPayload(record: RentalRecord) {
  return {
    patientKey: rentalPatientKey(record),
    patientId: record.patientId,
    patientName: record.patientName,
    parNumber: record.parNumber,
    parStatus: isRentalParExpired(record) ? "expired" : "expiring",
    parExpiration: record.parExpiration,
    parInitialDate: record.checkedOutDate,
    insurance: record.insuranceName || record.payor,
    insuranceStatus: record.payor ? "active" : "",
    salesOrderId: record.salesOrderId,
    salesOrderStatus: "rental",
    itemId: record.itemId,
    itemName: record.productName,
    quantity: record.quantity,
    procedureCode: record.procCode,
    modifiers: record.modifiers,
    branchOffice: record.location,
    actualDeliveryDate: record.checkedOutDate,
    nextBillingDate: record.nextBillingDate,
    orderingDoctor: record.orderingDoctor,
    sourceReport: "rentals",
    sourceRentalId: record.id,
    rentalStatus: record.status,
    rentalMonthlyRate: record.monthlyRate,
    rentalCharge: record.extCharge || record.charge,
    rentalAllow: record.extAllow || record.allow,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.email ?? null,
  };
}

export async function syncRentalParsToPatientRecords(
  recordsToSync: RentalRecord[],
  syncedKeys: Set<string>
): Promise<number> {
  let synced = 0;

  for (const record of recordsToSync) {
    const key = rentalParSyncKey(record);
    if (syncedKeys.has(key)) continue;

    const patientKey = rentalPatientKey(record);
    if (!patientKey || !record.parNumber || !record.parExpiration) {
      syncedKeys.add(key);
      continue;
    }

    const existing = await getDocs(
      query(
        collection(db, "patientAuthorizations"),
        where("patientKey", "==", patientKey),
        limit(200)
      )
    );
    const existingDoc = existing.docs.find(
      (docSnap) => rentalParNumber(docSnap.data().parNumber) === record.parNumber
    );

    const payload = buildPayload(record);

    if (existingDoc) {
      await updateDoc(doc(db, "patientAuthorizations", existingDoc.id), payload);
    } else {
      await addDoc(collection(db, "patientAuthorizations"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }

    syncedKeys.add(key);
    synced += 1;
  }

  return synced;
}
