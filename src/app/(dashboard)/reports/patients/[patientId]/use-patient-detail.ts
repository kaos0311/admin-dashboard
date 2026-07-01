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

type SourceRecord = Record<string, unknown>;

type OperationalSources = {
  rentals: SourceRecord[];
  insuranceRecords: SourceRecord[];
  physicians: SourceRecord[];
  referrals: SourceRecord[];
  hospicePatients: SourceRecord[];
  deliveryTickets: SourceRecord[];
};

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

function recordTimestampMs(record: SourceRecord): number {
  return [
    record.updatedAt,
    record.lastUpdated,
    record.createdAt,
    record.lastImportId,
    record.sourceReportId,
  ]
    .map((value) => {
      if (value && typeof value === "object" && "seconds" in value) {
        return Number((value as { seconds?: number }).seconds ?? 0) * 1000;
      }

      const parsed = Date.parse(text(value));
      return Number.isFinite(parsed) ? parsed : 0;
    })
    .sort((left, right) => right - left)[0] || 0;
}

function latestRecords(records: SourceRecord[]): SourceRecord[] {
  return records
    .slice()
    .sort((left, right) => recordTimestampMs(right) - recordTimestampMs(left));
}

function firstRecordText(records: SourceRecord[], ...keys: string[]): string {
  for (const record of latestRecords(records)) {
    for (const key of keys) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const exact = text(record[key]);
      if (exact) return exact;

      const match = Object.entries(record).find(
        ([sourceKey]) =>
          sourceKey.toLowerCase().replace(/[^a-z0-9]+/g, "") === normalizedKey,
      );

      if (match) {
        const value = text(match[1]);
        if (value) return value;
      }
    }
  }

  return "";
}

function splitName(value: string): { firstName?: string; lastName?: string } {
  const clean = value.trim();
  if (!clean) return {};

  if (clean.includes(",")) {
    const [lastName, firstName] = clean.split(",", 2);
    return {
      firstName: firstName?.trim(),
      lastName: lastName?.trim(),
    };
  }

  const parts = clean.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
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

function buildOperationalInsurance(records: SourceRecord[]): Record<string, unknown> | null {
  const latest = latestRecords(records);
  const insuranceName = firstRecordText(latest, "insuranceName", "insurance", "payerName", "payor", "primaryInsurance");
  const policyNumber = firstRecordText(latest, "policyNumber", "groupNumber", "group");
  const groupNumber = firstRecordText(latest, "groupNumber", "group");
  const status = firstRecordText(latest, "status", "insuranceStatus");
  const coverageTypes = firstRecordText(latest, "coverageTypes", "coverageType", "planType", "insuranceLevel", "payorLevel");

  if (!insuranceName && !policyNumber && !groupNumber && !status && !coverageTypes) return null;

  return {
    primaryInsurance: insuranceName,
    secondaryInsurance: firstRecordText(latest, "secondaryInsurance"),
    policyNumber,
    groupNumber,
    insuranceStatus: status,
    coverageTypes,
    payor: insuranceName,
  };
}

function buildOperationalProfile(records: SourceRecord[]): Record<string, unknown> | null {
  const latest = latestRecords(records);
  const primaryDoctor = firstRecordText(
    latest,
    "primaryDoctor",
    "primaryDoctorName",
    "primaryProvider",
    "primaryPhysician",
    "doctorName",
  );
  const orderingDoctor = firstRecordText(
    latest,
    "orderingDoctor",
    "orderingDoctorName",
    "orderingProvider",
    "orderingPhysician",
    "doctorName",
  );
  const referralName = firstRecordText(
    latest,
    "referralName",
    "referralProvider",
    "referringProvider",
    "referringDoctor",
    "referral",
  );
  const referralType = firstRecordText(latest, "referralType", "type");
  const branchOffice = firstRecordText(latest, "branch", "branchOffice");
  const facility = firstRecordText(latest, "facility", "facilityName");
  const nursingAgency = firstRecordText(latest, "nursingAgency", "hospiceProvider", "hospiceAgency");
  const customerType = firstRecordText(latest, "customerType");
  const patientId = firstRecordText(latest, "patientId", "ptKey");
  const accountNumber = firstRecordText(latest, "accountNumber", "acctNo", "acctNbr");
  const sex = firstRecordText(latest, "sex", "gender");

  const profile: Record<string, unknown> = {};
  const primary = splitName(primaryDoctor);
  const ordering = splitName(orderingDoctor);

  if (primaryDoctor) {
    profile.primaryDoctor = primaryDoctor;
    profile.primaryDoctorFirstName = primary.firstName;
    profile.primaryDoctorLastName = primary.lastName;
  }
  if (orderingDoctor) {
    profile.orderingDoctor = orderingDoctor;
    profile.orderingDoctorFirstName = ordering.firstName;
    profile.orderingDoctorLastName = ordering.lastName;
  }
  if (referralName) profile.referralName = referralName;
  if (referralType) profile.referralType = referralType;
  if (branchOffice) profile.branchOffice = branchOffice;
  if (facility) profile.facility = facility;
  if (nursingAgency) profile.nursingAgency = nursingAgency;
  if (customerType) profile.customerType = customerType;
  if (patientId) profile.patientId = patientId;
  if (accountNumber) profile.accountNumber = accountNumber;
  if (sex) profile.sex = sex;

  return Object.keys(profile).length > 0 ? profile : null;
}

function buildOperationalContact(records: SourceRecord[]): Record<string, unknown> | null {
  const latest = latestRecords(records);
  const phone = firstRecordText(latest, "phone", "patientPhone", "mobile", "cellPhone");
  const email = firstRecordText(latest, "email", "emailAddress");
  const address = firstRecordText(latest, "address", "patientAddress", "billingAddress", "deliveryAddress");
  const city = firstRecordText(latest, "city");
  const state = firstRecordText(latest, "state");
  const zip = firstRecordText(latest, "zip", "postalCode", "zipCode");

  if (!phone && !email && !address && !city && !state && !zip) return null;

  return { phone, email, address, city, state, zip };
}

function buildOperationalDelivery(records: SourceRecord[]): Record<string, unknown> | null {
  const latest = latestRecords(records);
  const salesOrderId = firstRecordText(latest, "salesOrderId", "orderNumber", "salesOrderNumber");
  const actualDeliveryDate = firstRecordText(latest, "actualDeliveryDate", "deliveryDate", "scheduledDeliveryDate");
  const scheduledDeliveryDate = firstRecordText(latest, "scheduledDeliveryDate", "nextDos", "expectedReturnDate");
  const deliveryTechName = firstRecordText(latest, "deliveryTechName", "technician");
  const comments = firstRecordText(latest, "comments", "notes");

  if (!salesOrderId && !actualDeliveryDate && !scheduledDeliveryDate && !deliveryTechName && !comments) return null;

  return {
    salesOrderId,
    actualDeliveryDate,
    scheduledDeliveryDate,
    deliveryTechName,
    comments,
  };
}

function buildOperationalWip(records: SourceRecord[]): Record<string, unknown> | null {
  const latest = latestRecords(records);
  const status = firstRecordText(latest, "status");
  const assignedTo = firstRecordText(latest, "assignedTo", "employee");
  const daysInState = firstRecordText(latest, "daysInState", "daysOpen");
  const dateNeeded = firstRecordText(latest, "dateNeeded", "dueDate");

  if (!status && !assignedTo && !daysInState && !dateNeeded) return null;

  return { status, assignedTo, daysInState, dateNeeded };
}

function buildOperationalAuthorization(records: SourceRecord[]): Record<string, unknown> | null {
  const latest = latestRecords(records);
  const parNumber = firstRecordText(latest, "parNumber", "PARNumber");
  const parStatus = firstRecordText(latest, "parStatus", "PARStatus");
  const parExpiration = firstRecordText(latest, "parExpiration", "PARExpiration");
  const parInitialDate = firstRecordText(latest, "parInitialDate", "PARInitialDate");

  if (!parNumber && !parStatus && !parExpiration && !parInitialDate) return null;

  return { parNumber, parStatus, parExpiration, parInitialDate };
}

function buildOperationalBrightree(
  contact: Record<string, unknown> | null,
  profile: Record<string, unknown> | null,
  physicians: SourceRecord[],
  referrals: SourceRecord[]
): Record<string, unknown> | null {
  const latestPhysicians = latestRecords(physicians);
  const latestReferrals = latestRecords(referrals);
  const primaryDoctor = firstRecordText(latestPhysicians, "primaryDoctor", "doctorName", "orderingDoctor");
  const orderingDoctor = firstRecordText(latestPhysicians, "orderingDoctor", "doctorName");
  const referralName = firstRecordText(latestReferrals, "referralName", "referralProvider", "referringProvider");
  const referralType = firstRecordText(latestReferrals, "referralType", "type");
  const primary = splitName(primaryDoctor);
  const ordering = splitName(orderingDoctor);

  const brightree: Record<string, unknown> = {};
  if (contact) brightree.contact = contact;
  if (profile) brightree.demographics = profile;
  if (primaryDoctor) {
    brightree.physicians = {
      "Primary Doctor First Name": primary.firstName,
      "Primary Doctor Last Name": primary.lastName,
    };
  }
  if (orderingDoctor) {
    brightree.physicians = {
      ...(recordValue(brightree.physicians) ?? {}),
      "Ordering Doctor First Name": ordering.firstName,
      "Ordering Doctor Last Name": ordering.lastName,
    };
  }
  if (referralName || referralType) {
    brightree.referrals = {
      "Referral Name": referralName,
      "Referral Type": referralType,
    };
  }

  return Object.keys(brightree).length > 0 ? brightree : null;
}

function mergePatientSources(args: {
  patientId: string;
  base: Partial<PatientRecord> | null;
  indexed: Partial<PatientRecord> | null;
  authorizations: PatientAuthorizationLine[];
  equipment: Array<Record<string, unknown>>;
  purchases: Array<Record<string, unknown>>;
  operational: OperationalSources;
}): PatientRecord | null {
  if (!args.base && !args.indexed) return null;

  const base = args.base ?? {};
  const indexed = args.indexed ?? {};
  const operational = args.operational;
  const allOperationalRecords = [
    ...operational.rentals,
    ...operational.insuranceRecords,
    ...operational.physicians,
    ...operational.referrals,
    ...operational.hospicePatients,
    ...operational.deliveryTickets,
  ];
  const operationalContact = buildOperationalContact(allOperationalRecords);
  const operationalProfile = buildOperationalProfile(allOperationalRecords);
  const operationalInsurance = buildOperationalInsurance([
    ...operational.insuranceRecords,
    ...operational.rentals,
    ...operational.hospicePatients,
    ...operational.deliveryTickets,
    ...operational.physicians,
  ]);
  const operationalDelivery = buildOperationalDelivery([
    ...operational.deliveryTickets,
    ...operational.rentals,
  ]);
  const operationalWip = buildOperationalWip(operational.rentals);
  const operationalAuthorization = buildOperationalAuthorization(args.authorizations.map((line) => ({
    parNumber: line.parNumber,
    parStatus: line.parStatus,
    parExpiration: line.parExpiration,
    parInitialDate: line.parInitialDate,
    updatedAt: line.printedAt,
  })));
  const brightree = buildOperationalBrightree(
    operationalContact,
    operationalProfile,
    operational.physicians,
    operational.referrals,
  );
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
    patientId: firstDefined(
      base.patientId,
      indexed.patientId,
      operationalContact?.patientId as string | undefined,
      operationalProfile?.patientId as string | undefined,
    ),
    firstName: firstDefined(base.firstName, indexed.firstName),
    lastName: firstDefined(base.lastName, indexed.lastName),
    fullName: firstDefined(base.fullName, indexed.fullName),
    dateOfBirth: firstDefined(
      base.dateOfBirth,
      indexed.dateOfBirth,
      firstRecordText(operational.rentals, "patientDob", "dob", "dateOfBirth"),
    ),
    dateOfDeath: firstDefined(base.dateOfDeath, indexed.dateOfDeath),
    phone: firstDefined(
      base.phone,
      indexed.phone,
      operationalContact?.phone as string | undefined,
    ),
    email: firstDefined(
      base.email,
      indexed.email,
      operationalContact?.email as string | undefined,
    ),
    address: firstDefined(
      base.address,
      indexed.address,
      operationalContact?.address as string | undefined,
    ),
    city: firstDefined(
      base.city,
      indexed.city,
      operationalContact?.city as string | undefined,
    ),
    state: firstDefined(
      base.state,
      indexed.state,
      operationalContact?.state as string | undefined,
    ),
    zip: firstDefined(
      base.zip,
      indexed.zip,
      operationalContact?.zip as string | undefined,
    ),
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
    profile: mergeRecord(
      mergeRecord(base.profile, indexed.profile),
      operationalProfile,
    ),
    insurance: mergeRecord(
      mergeRecord(base.insurance, indexed.insurance),
      operationalInsurance,
    ),
    brightree: mergeRecord(mergeRecord(base.brightree, indexed.brightree), brightree),
    authorization: mergeRecord(
      mergeRecord(base.authorization, indexed.authorization),
      operationalAuthorization,
    ),
    cmn: mergeRecord(base.cmn, indexed.cmn),
    billing: mergeRecord(base.billing, indexed.billing),
    wip: mergeRecord(mergeRecord(base.wip, indexed.wip), operationalWip),
    deliverySummary: mergeRecord(
      mergeRecord(base.deliverySummary, indexed.deliverySummary),
      operationalDelivery,
    ),
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
    hospice: base.hospice === true || indexed.hospice === true || operational.hospicePatients.length > 0,
    hospiceStatus: firstDefined(
      base.hospiceStatus,
      indexed.hospiceStatus,
      firstRecordText(operational.hospicePatients, "status", "hospiceStatus"),
    ),
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
    sourceReport: text(data.sourceReport),
    sourceRentalId: text(data.sourceRentalId),
    rentalStatus: text(data.rentalStatus),
    rentalMonthlyRate: numberValue(data.rentalMonthlyRate),
    rentalCharge: numberValue(data.rentalCharge),
    rentalAllow: numberValue(data.rentalAllow),
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
    const operationalQueries = {
      rentals: query(
        collection(db, "rentals"),
        where("patientKey", "==", patientId),
        limit(100)
      ),
      insuranceRecords: query(
        collection(db, "insuranceRecords"),
        where("patientKey", "==", patientId),
        limit(100)
      ),
      physicians: query(
        collection(db, "patientPhysicians"),
        where("patientKey", "==", patientId),
        limit(100)
      ),
      referrals: query(
        collection(db, "patientReferrals"),
        where("patientKey", "==", patientId),
        limit(100)
      ),
      hospicePatients: query(
        collection(db, "hospicePatients"),
        where("patientKey", "==", patientId),
        limit(25)
      ),
      deliveryTickets: query(
        collection(db, "patientDeliveryTickets"),
        where("patientKey", "==", patientId),
        limit(100)
      ),
    };

    let latestBasePatient: Partial<PatientRecord> | null = null;
    let latestIndexedPatient: Partial<PatientRecord> | null = null;
    let latestAuthorizations: PatientAuthorizationLine[] = [];
    let latestEquipment: Array<Record<string, unknown>> = [];
    let latestPurchases: Array<Record<string, unknown>> = [];
    let latestOperational: OperationalSources = {
      rentals: [],
      insuranceRecords: [],
      physicians: [],
      referrals: [],
      hospicePatients: [],
      deliveryTickets: [],
    };

    function publishPatient() {
      setPatient(
        mergePatientSources({
          patientId: patientId ?? "",
          base: latestBasePatient,
          indexed: latestIndexedPatient,
          authorizations: latestAuthorizations,
          equipment: latestEquipment,
          purchases: latestPurchases,
          operational: latestOperational,
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

    const unsubscribeOperational = Object.entries(operationalQueries).map(
      ([collectionKey, operationalQuery]) =>
        onSnapshot(
          operationalQuery,
          (snapshot) => {
            latestOperational = {
              ...latestOperational,
              [collectionKey]: snapshot.docs.map(
                (item) => item.data() as SourceRecord
              ),
            };
            publishPatient();
          },
          (error) => {
            console.error(`PATIENT ${collectionKey.toUpperCase()} LOAD ERROR:`, error);
          }
        )
    );

    return () => {
      unsubscribePatient();
      unsubscribePatientIndex();
      unsubscribeAuthorizations();
      unsubscribeEquipment();
      unsubscribePurchases();
      unsubscribeOperational.forEach((unsubscribe) => unsubscribe());
    };
  }, [patientId]);

  return {
    patient,
    loading,
    message,
    setMessage,
  };
}

