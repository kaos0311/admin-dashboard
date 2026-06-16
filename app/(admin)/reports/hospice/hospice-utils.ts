import type { DocumentData, Timestamp } from "firebase/firestore";

import { badges } from "@/theme";

import type {
  HospicePatient,
  HospiceRentalItem,
  HospiceStats,
  HospiceStatus,
  MemorialPatient,
  RiskFilter,
  RiskLevel,
  SortMode,
  StatusFilter,
} from "./hospice-types";

export const HOSPICE_CONTRACT_PAYOR = "Pennyroyal Hospice";

export function getString(
  data: DocumentData,
  keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

export function getStringArray(
  data: DocumentData,
  keys: readonly string[]
): string[] {
  for (const key of keys) {
    const value = data[key];

    if (Array.isArray(value)) {
      return Array.from(
        new Set(
          value
            .map((item) => {
              if (typeof item === "string") return item.trim();

              if (typeof item === "number" && Number.isFinite(item)) {
                return String(item);
              }

              if (item && typeof item === "object") {
                const record = item as Record<string, unknown>;

                return String(
                  record.name ??
                    record.itemName ??
                    record.productName ??
                    record.description ??
                    record.label ??
                    ""
                ).trim();
              }

              return "";
            })
            .filter(Boolean)
        )
      );
    }

    if (typeof value === "string" && value.trim()) {
      return Array.from(
        new Set(
          value
            .split(/[,\n]/)
            .map((item) => item.trim())
            .filter(Boolean)
        )
      );
    }
  }

  return [];
}

function getNumberValue(
  record: Record<string, unknown>,
  keys: readonly string[]
): number | undefined {
  for (const key of keys) {
    const value = record[key];
    const parsed = Number(value);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function getRecordString(
  record: Record<string, unknown>,
  keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

export function hospiceRentalItemLabel(item: HospiceRentalItem): string {
  return [
    item.itemName,
    item.procCode || item.hcpc ? `(${item.procCode || item.hcpc})` : "",
    item.serialNumber ? `SN ${item.serialNumber}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeRentalItem(
  value: unknown,
  fallbackIndex: number
): HospiceRentalItem | null {
  if (typeof value === "string") {
    const itemName = value.trim();
    return itemName ? { itemId: `manual-${fallbackIndex}`, itemName } : null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const itemName = getRecordString(record, [
    "itemName",
    "productName",
    "name",
    "description",
    "label",
  ]);

  if (!itemName) return null;

  const procCode = getRecordString(record, ["procCode", "hcpc", "hcpcs", "hcpcsCode"]);
  const startDate = getRecordString(record, ["startDate", "originalDos", "checkedOutDate"]);
  const nextBillingDate = getRecordString(record, [
    "nextBillingDate",
    "nextDos",
    "expectedReturnDate",
  ]);

  return {
    itemId: getRecordString(record, ["itemId", "sku", "productId"]),
    itemName,
    itemGroup: getRecordString(record, ["itemGroup", "category"]),
    procCode,
    hcpc: getRecordString(record, ["hcpc", "hcpcs", "hcpcsCode"]) || procCode,
    modifiers: getRecordString(record, ["modifiers"]),
    serialNumber: getRecordString(record, ["serialNumber", "serial", "SerialNum"]),
    salesOrderId: getRecordString(record, ["salesOrderId", "orderId"]),
    salesOrderDetailId: getRecordString(record, ["salesOrderDetailId"]),
    originalDos: getRecordString(record, ["originalDos", "startDate", "checkedOutDate"]),
    nextDos: getRecordString(record, ["nextDos", "nextBillingDate", "expectedReturnDate"]),
    startDate,
    nextBillingDate,
    quantity: getNumberValue(record, ["quantity", "qty", "ItemQuantity"]),
    status: getRecordString(record, ["status", "rentalStatus"]),
  };
}

function rentalItemKey(item: HospiceRentalItem): string {
  return (
    item.salesOrderDetailId ||
    [
      item.itemId,
      item.itemName,
      item.procCode || item.hcpc,
      item.serialNumber,
      item.originalDos || item.startDate,
    ]
      .filter(Boolean)
      .join("|") ||
    item.itemName
  )
    .toLowerCase()
    .trim();
}

export function getRentalItems(data: DocumentData): HospiceRentalItem[] {
  const rawSources = [data.rentalItems, data.currentEquipment, data.equipment];
  const items: HospiceRentalItem[] = [];

  rawSources.forEach((source) => {
    if (!Array.isArray(source)) return;

    source.forEach((value, index) => {
      const item = normalizeRentalItem(value, index);

      if (item) items.push(item);
    });
  });

  if (items.length === 0) {
    getStringArray(data, ["equipment", "items", "activeEquipment", "products"]).forEach(
      (itemName, index) => {
        items.push({ itemId: `manual-${index}`, itemName });
      }
    );
  }

  const map = new Map<string, HospiceRentalItem>();

  items.forEach((item) => {
    const key = rentalItemKey(item);
    const existing = map.get(key);

    map.set(key, existing ? { ...existing, ...item } : item);
  });

  return Array.from(map.values());
}

export function formatTimestamp(value: unknown): string | undefined {
  if (!value) return undefined;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toLocaleDateString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return undefined;

    const parsed = Date.parse(trimmed);

    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toLocaleDateString();
    }

    return trimmed;
  }

  const maybeTimestamp = value as Timestamp;

  if (typeof maybeTimestamp?.toDate === "function") {
    const date = maybeTimestamp.toDate();

    return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString();
  }

  return undefined;
}

export function timestampValue(value?: string): number {
  if (!value) return 0;

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? 0 : parsed;
}

export function isActiveHospiceReportPatient(patient: HospicePatient): boolean {
  return (
    !patient.dateOfDeath &&
    ["active", "living", "pending_pickup"].includes(patient.status)
  );
}

export function getRecentMemorialPatients(
  patients: readonly HospicePatient[]
): MemorialPatient[] {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 5);

  return patients
    .map((patient) => {
      const deathTime = timestampValue(patient.dateOfDeath);

      if (!deathTime || deathTime < cutoff.getTime()) {
        return null;
      }

      return {
        id: patient.id,
        patientName: patient.patientName,
        dateOfBirth: patient.dateOfBirth || "Missing",
        dateOfDeath: patient.dateOfDeath || "Missing",
        deathTime,
      };
    })
    .filter((patient): patient is MemorialPatient => Boolean(patient))
    .sort((a, b) => b.deathTime - a.deathTime);
}

export function normalizeStatus(value?: string): HospiceStatus {
  const normalized = value
    ?.toLowerCase()
    .trim()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  if (!normalized) return "unknown";

  if (normalized.includes("deceased") || normalized.includes("dead")) {
    return "deceased";
  }

  if (normalized.includes("discharged") || normalized.includes("discharge")) {
    return "discharged";
  }

  if (normalized.includes("pickup") || normalized.includes("pick_up")) {
    return "pending_pickup";
  }

  if (normalized.includes("inactive")) return "discharged";
  if (normalized.includes("closed")) return "discharged";
  if (normalized.includes("living")) return "living";
  if (normalized.includes("active")) return "active";

  return "unknown";
}

export function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function buildPatientName(data: DocumentData): string {
  const directName = getString(data, [
    "patientName",
    "fullName",
    "name",
    "residentName",
    "clientName",
  ]);

  if (directName) return directName;

  const firstName = getString(data, ["firstName", "first_name"]);
  const lastName = getString(data, ["lastName", "last_name"]);

  const builtName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return builtName || "Unknown Patient";
}

export function riskRank(risk: RiskLevel): number {
  if (risk === "high") return 3;
  if (risk === "medium") return 2;

  return 1;
}

export function calculateRisk(
  patient: Omit<HospicePatient, "riskLevel" | "riskReasons">
): Pick<HospicePatient, "riskLevel" | "riskReasons"> {
  const reasons: string[] = [];
  const attentionReasons: string[] = [];

  if (!patient.nurseName) attentionReasons.push("Missing nurse assignment");
  if (!patient.payor) attentionReasons.push("Missing payor");
  if (!patient.dateOfBirth) attentionReasons.push("Missing DOB");
  if (!patient.nextOfKin) attentionReasons.push("Missing next-of-kin");

  if (patient.status === "pending_pickup") {
    reasons.push("Pending equipment pickup");
  }

  if (patient.openIssues.length > 0) {
    reasons.push("Open hospice issue");
  }

  const uniqueReasons = Array.from(new Set([...reasons, ...attentionReasons]));

  if (reasons.length > 0) {
    return {
      riskLevel: "high",
      riskReasons: uniqueReasons,
    };
  }

  if (attentionReasons.length > 0) {
    return {
      riskLevel: "medium",
      riskReasons: uniqueReasons,
    };
  }

  return {
    riskLevel: "low",
    riskReasons: ["No obvious hospice gaps found"],
  };
}

export function normalizeHospiceDoc(
  id: string,
  data: DocumentData,
  source: string
): HospicePatient {
  const rentalItems = getRentalItems(data);
  const equipment = rentalItems.length
    ? rentalItems.map(hospiceRentalItemLabel)
    : getStringArray(data, [
        "equipment",
        "items",
        "activeEquipment",
        "rentalItems",
        "products",
      ]);
  const dateOfDeath = getString(data, [
    "dateOfDeath",
    "dod",
    "DOD",
    "deathDate",
    "death_date",
    "date_of_death",
    "DateOfDeath",
    "Date Of Death",
  ]);
  const base: Omit<HospicePatient, "riskLevel" | "riskReasons"> = {
    id,
    patientId: getString(data, [
      "patientId",
      "patientID",
      "patient_id",
      "patientNumber",
      "patient_number",
      "mrn",
      "MRN",
    ]),
    patientName: buildPatientName(data),
    dateOfBirth: getString(data, [
      "dateOfBirth",
      "dob",
      "DOB",
      "birthDate",
      "birth_date",
      "patientDob",
      "patientDOB",
    ]),
    dateOfDeath,
    status: dateOfDeath
      ? "deceased"
      : normalizeStatus(
          getString(data, [
            "status",
            "patientStatus",
            "livingStatus",
            "lifeStatus",
            "hospiceStatus",
          ]) || (data.active === true ? "active" : undefined)
        ),
    hospiceProvider: getString(data, [
      "hospiceProvider",
      "provider",
      "hospiceName",
      "agency",
      "facility",
    ]) || HOSPICE_CONTRACT_PAYOR,
    nurseName: getString(data, [
      "nurseName",
      "nurse",
      "assignedNurse",
      "caseManager",
      "caseManagerName",
    ]),
    nursePhone: getString(data, [
      "nursePhone",
      "caseManagerPhone",
      "nurse_phone",
    ]),
    payor: getString(data, [
      "payor",
      "payer",
      "insurance",
      "insuranceName",
      "primaryInsurance",
    ]) || HOSPICE_CONTRACT_PAYOR,
    nextOfKin: getString(data, [
      "nextOfKin",
      "nok",
      "emergencyContact",
      "emergencyContactName",
    ]),
    phone: getString(data, [
      "phone",
      "patientPhone",
      "phoneNumber",
      "mobilePhone",
      "homePhone",
    ]),
    address: getString(data, [
      "address",
      "patientAddress",
      "streetAddress",
      "fullAddress",
    ]),
    equipment,
    rentalItems,
    openIssues: getStringArray(data, [
      "openIssues",
      "issues",
      "flags",
      "problems",
      "alerts",
    ]),
    notes: getString(data, ["notes", "comments", "memo"]),
    source,
    lastUpdated:
      formatTimestamp(data.updatedAt) ??
      formatTimestamp(data.lastUpdated) ??
      formatTimestamp(data.createdAt),
  };

  return {
    ...base,
    ...calculateRisk(base),
  };
}

export function buildHospiceMergeKey(patient: HospicePatient): string {
  const patientId = patient.patientId?.trim();

  if (patientId) return `id:${patientId.toLowerCase()}`;

  const fallbackParts = [
    patient.patientName.toLowerCase().trim(),
    patient.dateOfBirth?.trim(),
    patient.phone?.trim(),
    patient.address?.toLowerCase().trim(),
  ].filter(Boolean);

  if (fallbackParts.length > 1) {
    return `fallback:${fallbackParts.join("|")}`;
  }

  return `record:${patient.id}`;
}

export function mergeHospicePatients(
  records: readonly HospicePatient[]
): HospicePatient[] {
  const patientMap = new Map<string, HospicePatient>();

  records.forEach((patient) => {
    const key = buildHospiceMergeKey(patient);
    const existing = patientMap.get(key);

    if (!existing) {
      patientMap.set(key, patient);
      return;
    }

    const mergedDateOfDeath = patient.dateOfDeath ?? existing.dateOfDeath;
    const mergedStatus = mergedDateOfDeath
      ? "deceased"
      : patient.status !== "unknown"
        ? patient.status
        : existing.status;
    const mergedRiskLevel =
      riskRank(patient.riskLevel) > riskRank(existing.riskLevel)
        ? patient.riskLevel
        : existing.riskLevel;
    const rentalItemMap = new Map<string, HospiceRentalItem>();

    [...existing.rentalItems, ...patient.rentalItems].forEach((item) => {
      const key = rentalItemKey(item);
      const current = rentalItemMap.get(key);

      rentalItemMap.set(key, current ? { ...current, ...item } : item);
    });

    const rentalItems = Array.from(rentalItemMap.values());
    const equipment = Array.from(
      new Set([
        ...rentalItems.map(hospiceRentalItemLabel),
        ...existing.equipment,
        ...patient.equipment,
      ])
    );

    patientMap.set(key, {
      ...existing,
      ...patient,
      patientId: patient.patientId ?? existing.patientId,
      patientName:
        patient.patientName !== "Unknown Patient"
          ? patient.patientName
          : existing.patientName,
      dateOfBirth: patient.dateOfBirth ?? existing.dateOfBirth,
      dateOfDeath: mergedDateOfDeath,
      status: mergedStatus,
      hospiceProvider: HOSPICE_CONTRACT_PAYOR,
      nurseName: patient.nurseName ?? existing.nurseName,
      nursePhone: patient.nursePhone ?? existing.nursePhone,
      payor: HOSPICE_CONTRACT_PAYOR,
      nextOfKin: patient.nextOfKin ?? existing.nextOfKin,
      phone: patient.phone ?? existing.phone,
      address: patient.address ?? existing.address,
      notes: patient.notes ?? existing.notes,
      source: patient.source ?? existing.source,
      lastUpdated: patient.lastUpdated ?? existing.lastUpdated,
      equipment,
      rentalItems,
      openIssues: Array.from(
        new Set([...existing.openIssues, ...patient.openIssues])
      ),
      riskLevel: mergedRiskLevel,
      riskReasons: Array.from(
        new Set([...existing.riskReasons, ...patient.riskReasons])
      ),
    });
  });

  return Array.from(patientMap.values());
}

export function getHospiceStats(
  patients: readonly HospicePatient[]
): HospiceStats {
  return {
    total: patients.length,
    active: patients.filter(
      (patient) => patient.status === "active" || patient.status === "living"
    ).length,
    deceased: patients.filter((patient) => patient.status === "deceased").length,
    pendingPickup: patients.filter(
      (patient) => patient.status === "pending_pickup"
    ).length,
    highRisk: patients.filter((patient) => patient.riskLevel === "high").length,
    missingNurse: patients.filter((patient) => !patient.nurseName).length,
    missingPayor: patients.filter((patient) => !patient.payor).length,
  };
}

export function filterHospicePatients({
  patients,
  searchText,
  statusFilter,
  riskFilter,
  sortMode,
}: {
  patients: readonly HospicePatient[];
  searchText: string;
  statusFilter: StatusFilter;
  riskFilter: RiskFilter;
  sortMode: SortMode;
}): HospicePatient[] {
  const text = searchText.toLowerCase().trim();

  return patients
    .filter((patient) => {
      const searchable = [
        patient.id,
        patient.patientId,
        patient.patientName,
        patient.dateOfBirth,
        patient.hospiceProvider,
        patient.nurseName,
        patient.nursePhone,
        patient.payor,
        patient.nextOfKin,
        patient.phone,
        patient.address,
        patient.notes,
        patient.source,
        patient.equipment.join(" "),
        patient.rentalItems.map(hospiceRentalItemLabel).join(" "),
        patient.openIssues.join(" "),
        patient.riskReasons.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !text || searchable.includes(text);
      const matchesStatus =
        statusFilter === "all" || patient.status === statusFilter;
      const matchesRisk =
        riskFilter === "all" || patient.riskLevel === riskFilter;

      return matchesSearch && matchesStatus && matchesRisk;
    })
    .sort((a, b) => {
      if (sortMode === "riskDesc") {
        const riskDifference = riskRank(b.riskLevel) - riskRank(a.riskLevel);

        if (riskDifference !== 0) return riskDifference;

        return a.patientName.localeCompare(b.patientName);
      }

      if (sortMode === "statusAsc") {
        const statusDifference = a.status.localeCompare(b.status);

        if (statusDifference !== 0) return statusDifference;

        return a.patientName.localeCompare(b.patientName);
      }

      if (sortMode === "updatedDesc") {
        const dateDifference =
          timestampValue(b.lastUpdated) - timestampValue(a.lastUpdated);

        if (dateDifference !== 0) return dateDifference;

        return a.patientName.localeCompare(b.patientName);
      }

      return a.patientName.localeCompare(b.patientName);
    });
}

export function badgeClass(value: string): string {
  switch (value) {
    case "high":
    case "deceased":
    case "pending_pickup":
      return badges.danger;

    case "medium":
    case "discharged":
      return badges.warning;

    case "low":
    case "active":
    case "living":
      return badges.success;

    default:
      return badges.neutral;
  }
}


