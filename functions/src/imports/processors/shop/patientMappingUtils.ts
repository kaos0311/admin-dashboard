import { FieldValue } from "firebase-admin/firestore";
import type { ImportRow } from "../../types/stagingChunk";
import type { BulkSetInput } from "../../utils/bulkWriter";
import { safeFirestoreId } from "../../utils/hash";
import {
  clean,
  normalize,
  read,
  toDateString,
} from "./shopRowUtils";

export function patientBaseWrites(patientKey: string, data: Record<string, unknown>): BulkSetInput[] {
  const baseData = clean(data);
  const writes: BulkSetInput[] = [
    { path: "patients", id: patientKey, data: baseData },
    {
      path: "patients_index",
      id: patientKey,
      data: clean({
        patientKey,
        patientId: baseData.patientId,
        patientName: baseData.patientName,
        dob: baseData.dob,
        dateOfBirth: baseData.dateOfBirth || baseData.dob,
        dateOfDeath: baseData.dateOfDeath,
        dod: baseData.dod || baseData.dateOfDeath,
        phone: baseData.phone,
        email: baseData.email,
        address: baseData.address,
        city: baseData.city,
        state: baseData.state,
        zip: baseData.zip,
        insuranceName: baseData.insuranceName,
        profile: baseData.profile,
        insurance: baseData.insurance,
        brightree: baseData.brightree,
        authorization: baseData.authorization,
        cmn: baseData.cmn,
        billing: baseData.billing,
        wip: baseData.wip,
        deliverySummary: baseData.deliverySummary,
        currentEquipment: baseData.currentEquipment,
        currentEquipmentCount: baseData.currentEquipmentCount,
        purchasesLast90Days: baseData.purchasesLast90Days,
        purchasesLast90DaysCount: baseData.purchasesLast90DaysCount,
        hospice: baseData.hospice,
        hospiceStatus: baseData.hospiceStatus,
        primaryDoctor:
          baseData.primaryDoctor ||
          (baseData.profile && typeof baseData.profile === "object"
            ? (baseData.profile as Record<string, unknown>).primaryDoctor
            : ""),
        orderingDoctor:
          baseData.orderingDoctor ||
          (baseData.profile && typeof baseData.profile === "object"
            ? (baseData.profile as Record<string, unknown>).orderingDoctor
            : ""),
        searchText: baseData.searchText,
        lastImportId: baseData.lastImportId,
      }),
    },
  ];

  if (baseData.hospice === true) {
    writes.push({
      path: "hospicePatients",
      id: patientKey,
      data: clean({
        hospiceKey: patientKey,
        patientKey,
        patientId: baseData.patientId,
        patientName: baseData.patientName,
        dob: baseData.dob,
        dateOfBirth: baseData.dateOfBirth || baseData.dob,
        dateOfDeath: baseData.dateOfDeath,
        dod: baseData.dod || baseData.dateOfDeath,
        phone: baseData.phone,
        insuranceName:
          baseData.insuranceName ||
          (baseData.insurance && typeof baseData.insurance === "object"
            ? (baseData.insurance as Record<string, unknown>).primaryInsurance ||
              (baseData.insurance as Record<string, unknown>).payor
            : ""),
        searchText: baseData.searchText,
        active: baseData.hospiceStatus === "active" || baseData.hospiceStatus === "living",
        status: baseData.hospiceStatus || (baseData.dateOfDeath ? "deceased" : "unknown"),
        hospiceSource: "adhoc_identifier",
        lastImportId: baseData.lastImportId,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    });
  }

  return writes;
}

export function readPatientIdentity(row: ImportRow) {
  const patientId = read(row, ["Patient ID", "PtID", "PtKey", "Patient Account Number"]);
  const parsedName = splitPatientName(read(row, ["FullName", "PatientName", "Patient Name"]));
  const firstName = read(row, ["Patient First Name"]) || parsedName.firstName;
  const lastName = stripHospiceMarker(read(row, [
    "Patient Last Name",
    "Patient_Last_Name",
    "PatientLastName",
    "Last Name",
    "Last_Name",
    "LastName",
    "LName",
  ]) || parsedName.lastName);
  const patientName = stripHospiceMarker(read(row, ["FullName", "PatientName", "Patient Name"]) || [firstName, lastName].filter(Boolean).join(" "));
  const dob = read(row, ["Patient DOB", "PtDOB"]);
  const patientKey = patientId
    ? safeFirestoreId(patientId, "patient")
    : safeFirestoreId(`${patientName}-${dob}`, "patient");

  return { patientKey, patientId, firstName, lastName, patientName, dob };
}

export function readDateOfDeath(row: ImportRow): string {
  return toDateString(read(row, [
    "DOD",
    "Date Of Death",
    "Date of Death",
    "DateOfDeath",
    "Death Date",
    "death_date",
    "date_of_death",
    "Patient DOD",
    "Patient Date Of Death",
  ]));
}

export function brightreeSection(
  section: "demographics" | "contact" | "physicians" | "referrals",
  row: ImportRow,
  importId: string
): Record<string, unknown> {
  return {
    [section]: clean({
      ...row,
      lastImportId: importId,
      importedAt: FieldValue.serverTimestamp(),
    }),
  };
}

function stripHospiceMarker(value: string): string {
  return value.replace(/^\*+/, "").replace(/\*\s*$/, "").trim();
}

export function normalizePersonName(value: string): string {
  const cleanName = stripHospiceMarker(value).replace(/\s+/g, " ").trim();
  if (!cleanName) return "";

  if (cleanName.includes(",")) {
    const [last = "", first = ""] = cleanName.split(",");
    return titleCase([first.trim(), last.trim()].filter(Boolean).join(" "));
  }

  return titleCase(cleanName);
}

function splitPatientName(value: string): { firstName: string; lastName: string } {
  const normalized = stripHospiceMarker(value).replace(/\s+/g, " ").trim();
  if (!normalized) return { firstName: "", lastName: "" };

  if (normalized.includes(",")) {
    const [lastName = "", firstName = ""] = normalized.split(",");
    return {
      firstName: titleCase(firstName.trim()),
      lastName: titleCase(lastName.trim()),
    };
  }

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return { firstName: titleCase(parts[0]), lastName: "" };
  }

  return {
    firstName: titleCase(parts.slice(0, -1).join(" ")),
    lastName: titleCase(parts.at(-1) ?? ""),
  };
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .trim();
}

export function isRecentDate(value: string): boolean {
  const iso = toDateString(value);
  if (!iso) return false;
  const now = Date.now();
  const target = Date.parse(iso);
  if (Number.isNaN(target)) return false;
  return now - target <= 90 * 24 * 60 * 60 * 1000;
}

export function rowLooksHospice(row: ImportRow, patient: ReturnType<typeof readPatientIdentity>, extraInsurance: string): boolean {
  const rawLastName = read(row, [
    "Patient Last Name",
    "Patient_Last_Name",
    "PatientLastName",
    "Last Name",
    "Last_Name",
    "LastName",
    "LName",
  ]);
  const rawPatientName = read(row, ["PatientName", "Patient Name", "Name", "Customer Name"]);
  const insuranceText = [
    extraInsurance,
    read(row, ["Insurance", "Primary Insurance", "PrimaryInsuranceName", "SecondaryInsuranceName", "Payor", "Payer"]),
  ].join(" ");
  const hospiceFlag = read(row, [
    "Hospice",
    "Is Hospice",
    "IsHospice",
    "Patient Is Hospice",
    "PatientIsHospice",
    "Hospice Patient",
  ]).toLowerCase();
  const allText = normalize([rawLastName, rawPatientName, insuranceText, hospiceFlag].join(" "));

  return (
    /^\s*\*/.test(rawLastName) ||
    /\*\s*$/.test(rawLastName) ||
    /^\s*\*/.test(rawPatientName) ||
    /\*\s*$/.test(rawPatientName) ||
    /\*\s*$/.test(patient.patientName) ||
    allText.includes("pennyroyal hospice") ||
    allText.includes("hospice") ||
    ["yes", "true", "1", "y"].includes(hospiceFlag)
  );
}

export function inferHospiceStatus(row: ImportRow, dateOfDeath: string): "active" | "living" | "deceased" | "discharged" | "pending_pickup" | "unknown" {
  if (dateOfDeath) return "deceased";

  const statusText = normalize([
    read(row, [
      "status",
      "Status",
      "Patient Status",
      "patientStatus",
      "livingStatus",
      "lifeStatus",
      "hospiceStatus",
      "Patient Customer Type",
      "SalesOrderStatus",
      "SOStatus",
      "WIPStatusName",
      "parstatus",
    ]),
    read(row, ["PatientName", "Patient Name"]),
    read(row, [
      "Patient Last Name",
      "Patient_Last_Name",
      "PatientLastName",
      "Last Name",
      "Last_Name",
      "LastName",
      "LName",
    ]),
  ].join(" "));

  if (
    statusText.includes("do not use") ||
    statusText.includes("deceased") ||
    statusText.includes("dead")
  ) {
    return "deceased";
  }

  if (
    statusText.includes("inactive") ||
    statusText.includes("discharged") ||
    statusText.includes("discharge") ||
    statusText.includes("closed") ||
    statusText.includes("terminated")
  ) {
    return "discharged";
  }

  if (statusText.includes("pickup") || statusText.includes("pick up")) {
    return "pending_pickup";
  }

  if (statusText.includes("living")) return "living";
  if (statusText.includes("active")) return "active";

  return "unknown";
}

export function compactAddress(row: ImportRow, prefix: "Billing Address" | "Delivery Address") {
  return clean({
    address1: read(row, [`${prefix} Address 1`]),
    address2: read(row, [`${prefix} Address 2`]),
    city: read(row, [`${prefix} City`]),
    state: read(row, [`${prefix} State`]),
    postalCode: read(row, [`${prefix} Postal Code`]),
    phone: read(row, [`${prefix} Phone`]),
  });
}

export function personName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}
