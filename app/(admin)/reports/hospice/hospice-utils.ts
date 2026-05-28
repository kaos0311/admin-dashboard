import type { DocumentData, Timestamp } from "firebase/firestore";

import type {
  HospicePatient,
  HospiceStats,
  HospiceStatus,
  RiskLevel,
  RiskFilter,
  SortMode,
  StatusFilter,
} from "./hospice-types";

export function getString(
  data: DocumentData,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return undefined;
}

export function getStringArray(data: DocumentData, keys: string[]): string[] {
  for (const key of keys) {
    const value = data[key];

    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === "string") return item.trim();

          if (item && typeof item === "object") {
            const record = item as Record<string, unknown>;

            return String(
              record.name ??
                record.itemName ??
                record.productName ??
                record.description ??
                ""
            ).trim();
          }

          return "";
        })
        .filter(Boolean);
    }

    if (typeof value === "string" && value.trim()) {
      return value
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

export function formatTimestamp(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;

  const maybeTimestamp = value as Timestamp;

  if (typeof maybeTimestamp?.toDate === "function") {
    return maybeTimestamp.toDate().toLocaleDateString();
  }

  return undefined;
}

export function normalizeStatus(value?: string): HospiceStatus {
  const normalized = value?.toLowerCase().trim().replaceAll(" ", "_");

  if (!normalized) return "unknown";
  if (normalized.includes("deceased") || normalized.includes("dead")) return "deceased";
  if (normalized.includes("discharged")) return "discharged";
  if (normalized.includes("pickup") || normalized.includes("pick_up")) {
    return "pending_pickup";
  }
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

  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(" ");
  }

  return "Unknown Patient";
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

  if (!patient.nurseName) reasons.push("Missing nurse assignment");
  if (!patient.payor) reasons.push("Missing payor");
  if (!patient.dateOfBirth) reasons.push("Missing DOB");
  if (!patient.nextOfKin) reasons.push("Missing next-of-kin");
  if (patient.status === "pending_pickup") reasons.push("Pending equipment pickup");
  if (patient.openIssues.length > 0) reasons.push("Open hospice issue");

  if (reasons.length >= 3 || patient.status === "pending_pickup") {
    return { riskLevel: "high", riskReasons: reasons };
  }

  if (reasons.length > 0) {
    return { riskLevel: "medium", riskReasons: reasons };
  }

  return { riskLevel: "low", riskReasons: ["No obvious hospice gaps found"] };
}

export function normalizeHospiceDoc(
  id: string,
  data: DocumentData,
  source: string
): HospicePatient {
  const base: Omit<HospicePatient, "riskLevel" | "riskReasons"> = {
    id,
    patientId: getString(data, ["patientId", "patientID", "patient_id"]),
    patientName: buildPatientName(data),
    dateOfBirth: getString(data, ["dateOfBirth", "dob", "DOB", "birthDate"]),
    status: normalizeStatus(
      getString(data, ["status", "patientStatus", "livingStatus", "lifeStatus"])
    ),
    hospiceProvider: getString(data, [
      "hospiceProvider",
      "provider",
      "hospiceName",
      "agency",
      "facility",
    ]),
    nurseName: getString(data, [
      "nurseName",
      "nurse",
      "assignedNurse",
      "caseManager",
      "caseManagerName",
    ]),
    nursePhone: getString(data, ["nursePhone", "caseManagerPhone"]),
    payor: getString(data, ["payor", "payer", "insurance", "insuranceName"]),
    nextOfKin: getString(data, ["nextOfKin", "nok", "emergencyContact"]),
    phone: getString(data, ["phone", "patientPhone", "phoneNumber"]),
    address: getString(data, ["address", "patientAddress", "streetAddress"]),
    equipment: getStringArray(data, [
      "equipment",
      "items",
      "activeEquipment",
      "rentalItems",
      "products",
    ]),
    openIssues: getStringArray(data, ["openIssues", "issues", "flags"]),
    notes: getString(data, ["notes", "comments", "memo"]),
    source,
    lastUpdated:
      formatTimestamp(data.updatedAt) ??
      formatTimestamp(data.createdAt) ??
      formatTimestamp(data.lastUpdated),
  };

  const risk = calculateRisk(base);

  return {
    ...base,
    ...risk,
  };
}

export function mergeHospicePatients(records: HospicePatient[]): HospicePatient[] {
  const patientMap = new Map<string, HospicePatient>();

  records.forEach((patient) => {
    const key =
      patient.patientId ||
      `${patient.patientName.toLowerCase()}-${patient.dateOfBirth ?? "no-dob"}`;

    const existing = patientMap.get(key);

    if (!existing) {
      patientMap.set(key, patient);
      return;
    }

    patientMap.set(key, {
      ...existing,
      ...patient,
      equipment: Array.from(new Set([...existing.equipment, ...patient.equipment])),
      openIssues: Array.from(new Set([...existing.openIssues, ...patient.openIssues])),
      riskLevel:
        riskRank(patient.riskLevel) > riskRank(existing.riskLevel)
          ? patient.riskLevel
          : existing.riskLevel,
      riskReasons: Array.from(
        new Set([...existing.riskReasons, ...patient.riskReasons])
      ),
    });
  });

  return Array.from(patientMap.values());
}

export function getHospiceStats(patients: HospicePatient[]): HospiceStats {
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
  patients: HospicePatient[];
  searchText: string;
  statusFilter: StatusFilter;
  riskFilter: RiskFilter;
  sortMode: SortMode;
}): HospicePatient[] {
  const text = searchText.toLowerCase().trim();

  return patients
    .filter((patient) => {
      const searchable = [
        patient.patientName,
        patient.dateOfBirth,
        patient.hospiceProvider,
        patient.nurseName,
        patient.payor,
        patient.nextOfKin,
        patient.phone,
        patient.address,
        patient.equipment.join(" "),
        patient.openIssues.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !text || searchable.includes(text);
      const matchesStatus =
        statusFilter === "all" || patient.status === statusFilter;
      const matchesRisk = riskFilter === "all" || patient.riskLevel === riskFilter;

      return matchesSearch && matchesStatus && matchesRisk;
    })
    .sort((a, b) => {
      if (sortMode === "riskDesc") {
        return riskRank(b.riskLevel) - riskRank(a.riskLevel);
      }

      if (sortMode === "statusAsc") {
        return a.status.localeCompare(b.status);
      }

      if (sortMode === "updatedDesc") {
        return (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? "");
      }

      return a.patientName.localeCompare(b.patientName);
    });
}

export function badgeClass(value: string): string {
  switch (value) {
    case "high":
    case "deceased":
    case "pending_pickup":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "medium":
    case "discharged":
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
    case "low":
    case "active":
    case "living":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}
