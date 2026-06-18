"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  type PatientAuthorizationLine,
  type PatientRecord,
  PATIENTS_COLLECTION,
} from "./patient-detail-types";
import { normalizePatient } from "./patient-detail-utils";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstDefined<T>(...values: Array<T | undefined>): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return undefined;
}

function mergeRecord(
  primary: unknown,
  fallback: unknown
): Record<string, unknown> | null {
  const primaryRecord = recordValue(primary);
  const fallbackRecord = recordValue(fallback);

  if (!primaryRecord && !fallbackRecord) return null;
  return { ...(fallbackRecord ?? {}), ...(primaryRecord ?? {}) };
}

function normalizeEquipmentItem(data: Record<string, unknown>) {
  return {
    itemId: text(data.itemId),
    itemName: text(data.itemName),
    hcpc: text(data.hcpc),
    category: text(data.category),
    saleType: text(data.saleType),
    qty: numberValue(data.qty),
    serialNumber: text(data.serialNumber),
    lotNumber: text(data.lotNumber),
    status: text(data.status),
    startDate: text(data.startDate),
    lastUpdated: text(data.lastUpdated),
    sourceFileName: text(data.sourceFileName),
    maintenanceStatus: text(data.maintenanceStatus),
    lastMaintenanceDate: text(data.lastMaintenanceDate),
    replacementDueDate: text(data.replacementDueDate),
    warrantyExpiration: text(data.warrantyExpiration),
    retrievalStatus: text(data.retrievalStatus),
  };
}

function normalizePurchaseItem(data: Record<string, unknown>) {
  return {
    itemId: text(data.itemId),
    itemName: text(data.itemName),
    hcpc: text(data.hcpc),
    purchaseDate: text(data.purchaseDate),
    quantity: numberValue(data.quantity),
    amount: numberValue(data.amount),
    orderId: text(data.orderId),
    sourceFileName: text(data.sourceFileName),
  };
}

function sortByDateDesc<T extends Record<string, unknown>>(
  items: T[],
  ...keys: string[]
): T[] {
  return items.slice().sort((left, right) => {
    const leftDate = Date.parse(
      keys.map((key) => text(left[key])).find(Boolean) ?? ""
    ) || 0;
    const rightDate = Date.parse(
      keys.map((key) => text(right[key])).find(Boolean) ?? ""
    ) || 0;

    return rightDate - leftDate;
  });
}

function mergePatientSources(args: {
  patientId: string;
  base: Partial<PatientRecord> | null;
  indexed: Partial<PatientRecord> | null;
  authorizations: PatientAuthorizationLine[];
  equipment: Array<Record<string, unknown>>;
  purchases: Array<Record<string, unknown>>;
}): PatientRecord | null {
  if (!args.base && !args.indexed) return null;

  const base = args.base ?? {};
  const indexed = args.indexed ?? {};
  const equipment =
    args.equipment.length > 0
      ? sortByDateDesc(
          args.equipment.map(normalizeEquipmentItem),
          "lastUpdated",
          "startDate"
        )
      : Array.isArray(base.currentEquipment)
        ? base.currentEquipment
        : Array.isArray(indexed.currentEquipment)
          ? indexed.currentEquipment
          : [];
  const purchases =
    args.purchases.length > 0
      ? sortByDateDesc(
          args.purchases.map(normalizePurchaseItem),
          "purchaseDate"
        )
      : Array.isArray(base.purchasesLast90Days)
        ? base.purchasesLast90Days
        : Array.isArray(indexed.purchasesLast90Days)
          ? indexed.purchasesLast90Days
          : [];

  return normalizePatient(args.patientId, {
    ...indexed,
    ...base,
    patientId: firstDefined(base.patientId, indexed.patientId),
    firstName: firstDefined(base.firstName, indexed.firstName),
    lastName: firstDefined(base.lastName, indexed.lastName),
    fullName: firstDefined(base.fullName, indexed.fullName),
    dateOfBirth: firstDefined(base.dateOfBirth, indexed.dateOfBirth),
    dateOfDeath: firstDefined(base.dateOfDeath, indexed.dateOfDeath),
    phone: firstDefined(base.phone, indexed.phone),
    email: firstDefined(base.email, indexed.email),
    address: firstDefined(base.address, indexed.address),
    city: firstDefined(base.city, indexed.city),
    state: firstDefined(base.state, indexed.state),
    zip: firstDefined(base.zip, indexed.zip),
    snapshot: firstDefined(base.snapshot, indexed.snapshot),
    patientSnapshot: firstDefined(base.patientSnapshot, indexed.patientSnapshot),
    lastEquipmentDate: firstDefined(
      base.lastEquipmentDate,
      indexed.lastEquipmentDate
    ),
    lastTreatmentDate: firstDefined(
      base.lastTreatmentDate,
      indexed.lastTreatmentDate
    ),
    lastActivityDate: firstDefined(
      base.lastActivityDate,
      indexed.lastActivityDate
    ),
    destroyEligibleDate: firstDefined(
      base.destroyEligibleDate,
      indexed.destroyEligibleDate
    ),
    profile: mergeRecord(base.profile, indexed.profile),
    insurance: mergeRecord(base.insurance, indexed.insurance),
    brightree: mergeRecord(base.brightree, indexed.brightree),
    authorization: mergeRecord(base.authorization, indexed.authorization),
    cmn: mergeRecord(base.cmn, indexed.cmn),
    billing: mergeRecord(base.billing, indexed.billing),
    wip: mergeRecord(base.wip, indexed.wip),
    deliverySummary: mergeRecord(base.deliverySummary, indexed.deliverySummary),
    cpap: base.cpap ?? indexed.cpap ?? null,
    currentEquipment: equipment,
    currentEquipmentCount: equipment.length || numberValue(base.currentEquipmentCount) || numberValue(indexed.currentEquipmentCount) || 0,
    purchasesLast90Days: purchases,
    purchasesLast90DaysCount: purchases.length || numberValue(base.purchasesLast90DaysCount) || numberValue(indexed.purchasesLast90DaysCount) || 0,
    authorizationLines: args.authorizations,
    reportTypes: Array.from(
      new Set([
        ...(Array.isArray(indexed.reportTypes) ? indexed.reportTypes : []),
        ...(Array.isArray(base.reportTypes) ? base.reportTypes : []),
      ])
    ),
    hospice: base.hospice === true || indexed.hospice === true,
    hospiceStatus: firstDefined(base.hospiceStatus, indexed.hospiceStatus),
    tasks: Array.isArray(base.tasks) ? base.tasks : Array.isArray(indexed.tasks) ? indexed.tasks : [],
    status: base.status ?? indexed.status,
    archivedAt: base.archivedAt ?? indexed.archivedAt,
    restoredAt: base.restoredAt ?? indexed.restoredAt,
    destroyedAt: base.destroyedAt ?? indexed.destroyedAt,
    notes: firstDefined(base.notes, indexed.notes),
    careNotes: firstDefined(base.careNotes, indexed.careNotes),
    equipmentNotes: firstDefined(base.equipmentNotes, indexed.equipmentNotes),
    billingNotes: firstDefined(base.billingNotes, indexed.billingNotes),
  });
}

function normalizeAuthorizationLine(
  id: string,
  data: Record<string, unknown>
): PatientAuthorizationLine {
  return {
    id,
    parNumber: text(data.parNumber),
    parKey: text(data.parKey),
    parStatus: text(data.parStatus),
    parExpiration: text(data.parExpiration),
    parInitialDate: text(data.parInitialDate),
    policyNumber: text(data.policyNumber),
    insurance: text(data.insurance),
    insuranceStatus: text(data.insuranceStatus),
    salesOrderId: text(data.salesOrderId),
    salesOrderStatus: text(data.salesOrderStatus),
    itemId: text(data.itemId),
    itemName: text(data.itemName),
    quantity: numberValue(data.quantity),
    procedureCode: text(data.procedureCode),
    modifiers: text(data.modifiers),
    branchOffice: text(data.branchOffice),
    actualDeliveryDate: text(data.actualDeliveryDate),
    nextBillingDate: text(data.nextBillingDate),
    orderingDoctor: text(data.orderingDoctor),
    printedBy: text(data.printedBy),
    printedAt: text(data.printedAt),
    faxedBy: text(data.faxedBy),
    faxedAt: text(data.faxedAt),
    rowIndex: numberValue(data.rowIndex),
  };
}

export function usePatientDetail(patientId?: string) {
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!patientId) {
      setPatient(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const patientRef = doc(db, PATIENTS_COLLECTION, patientId);
    const patientIndexRef = doc(db, "patients_index", patientId);
    const authorizationsQuery = query(
      collection(db, "patientAuthorizations"),
      where("patientKey", "==", patientId),
      limit(75)
    );
    const equipmentQuery = query(
      collection(db, "patients_index", patientId, "equipment"),
      limit(100)
    );
    const purchasesQuery = query(
      collection(db, "patients_index", patientId, "purchases"),
      limit(100)
    );

    let latestBasePatient: Partial<PatientRecord> | null = null;
    let latestIndexedPatient: Partial<PatientRecord> | null = null;
    let latestAuthorizations: PatientAuthorizationLine[] = [];
    let latestEquipment: Array<Record<string, unknown>> = [];
    let latestPurchases: Array<Record<string, unknown>> = [];

    function publishPatient() {
      setPatient(
        mergePatientSources({
          patientId: patientId ?? "",
          base: latestBasePatient,
          indexed: latestIndexedPatient,
          authorizations: latestAuthorizations,
          equipment: latestEquipment,
          purchases: latestPurchases,
        })
      );
    }

    const unsubscribePatient = onSnapshot(
      patientRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          latestBasePatient = null;
        } else {
          latestBasePatient = snapshot.data() as Partial<PatientRecord>;
        }

        publishPatient();
        setLoading(false);
      },
      (error) => {
        console.error("PATIENT DETAIL LOAD ERROR:", error);
        setPatient(null);
        setLoading(false);
        setMessage("Could not load patient detail. Check Firestore permissions.");
      }
    );

    const unsubscribePatientIndex = onSnapshot(
      patientIndexRef,
      (snapshot) => {
        latestIndexedPatient = snapshot.exists()
          ? (snapshot.data() as Partial<PatientRecord>)
          : null;
        publishPatient();
      },
      (error) => {
        console.error("PATIENT INDEX DETAIL LOAD ERROR:", error);
      }
    );

    const unsubscribeAuthorizations = onSnapshot(
      authorizationsQuery,
      (snapshot) => {
        latestAuthorizations = snapshot.docs
          .map((authSnapshot) =>
            normalizeAuthorizationLine(
              authSnapshot.id,
              authSnapshot.data() as Record<string, unknown>
            )
          )
          .sort((a, b) => {
            const dateA = Date.parse(a.parExpiration ?? "") || 0;
            const dateB = Date.parse(b.parExpiration ?? "") || 0;

            return dateB - dateA;
          });
        publishPatient();
      },
      (error) => {
        console.error("PATIENT PAR LINES LOAD ERROR:", error);
      }
    );

    const unsubscribeEquipment = onSnapshot(
      equipmentQuery,
      (snapshot) => {
        latestEquipment = snapshot.docs.map((item) => item.data() as Record<string, unknown>);
        publishPatient();
      },
      (error) => {
        console.error("PATIENT EQUIPMENT LOAD ERROR:", error);
      }
    );

    const unsubscribePurchases = onSnapshot(
      purchasesQuery,
      (snapshot) => {
        latestPurchases = snapshot.docs.map((item) => item.data() as Record<string, unknown>);
        publishPatient();
      },
      (error) => {
        console.error("PATIENT PURCHASE LOAD ERROR:", error);
      }
    );

    return () => {
      unsubscribePatient();
      unsubscribePatientIndex();
      unsubscribeAuthorizations();
      unsubscribeEquipment();
      unsubscribePurchases();
    };
  }, [patientId]);

  return {
    patient,
    loading,
    message,
    setMessage,
  };
}

