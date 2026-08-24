import { PATIENT_FIELD_ALIASES } from "./patientFieldAliases";
import type {
  PatientContactSnapshot,
  PatientInsuranceSnapshot,
  PatientNormalized,
} from "./patientTypes";
import { safeFirestoreId } from "../../utils/hash";

type UnknownRow = Record<string, unknown>;

export function normalizePatientRow(
  row: UnknownRow,
  rowIndex: number,
  importId: string
): PatientNormalized {
  const patientId = readString(row, PATIENT_FIELD_ALIASES.patientId);
  const rawName = readString(row, PATIENT_FIELD_ALIASES.patientName);
  const firstName = readString(row, PATIENT_FIELD_ALIASES.firstName);
  const lastName = readString(row, PATIENT_FIELD_ALIASES.lastName);
  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const patientName = stripHospiceMarker(rawName || combinedName);
  const dob = normalizeDate(readString(row, PATIENT_FIELD_ALIASES.dob));
  const dateOfDeath = normalizeDate(
    readString(row, PATIENT_FIELD_ALIASES.dateOfDeath)
  );
  const insuranceName = readString(row, PATIENT_FIELD_ALIASES.insuranceName);
  const primaryInsurance = readString(row, PATIENT_FIELD_ALIASES.primaryInsuranceName);
  const secondaryInsurance = readString(row, PATIENT_FIELD_ALIASES.secondaryInsuranceName);
  const primaryPolicyNumber = readString(row, PATIENT_FIELD_ALIASES.primaryInsurancePolicyNumber);
  const primaryGroupNumber = readString(row, PATIENT_FIELD_ALIASES.primaryInsuranceGroupNumber);
  const secondaryPolicyNumber = readString(row, PATIENT_FIELD_ALIASES.secondaryInsurancePolicyNumber);
  const secondaryGroupNumber = readString(row, PATIENT_FIELD_ALIASES.secondaryInsuranceGroupNumber);
  const resolvedInsuranceName = insuranceName || primaryInsurance;
  const customerType = readString(row, PATIENT_FIELD_ALIASES.customerType);
  const facility = readString(row, PATIENT_FIELD_ALIASES.facility);
  const nursingAgency = readString(row, PATIENT_FIELD_ALIASES.nursingAgency);
  const emergencyContact = compactContact({
    relationship: readString(row, PATIENT_FIELD_ALIASES.emergencyContactRelationship),
    firstName: readString(row, PATIENT_FIELD_ALIASES.emergencyContactFirstName),
    lastName: readString(row, PATIENT_FIELD_ALIASES.emergencyContactLastName),
    phone: readString(row, PATIENT_FIELD_ALIASES.emergencyContactPhone),
  });
  const responsibleParty = compactContact({
    relationship: readString(row, PATIENT_FIELD_ALIASES.responsiblePartyRelationship),
    firstName: readString(row, PATIENT_FIELD_ALIASES.responsiblePartyFirstName),
    lastName: readString(row, PATIENT_FIELD_ALIASES.responsiblePartyLastName),
    address1: readString(row, PATIENT_FIELD_ALIASES.responsiblePartyAddress1),
    phone: readString(row, PATIENT_FIELD_ALIASES.responsiblePartyPhone),
  });
  const primaryDoctor = readString(row, PATIENT_FIELD_ALIASES.primaryDoctor);
  const orderingDoctor = readString(row, PATIENT_FIELD_ALIASES.orderingDoctor);
  const referralName = readString(row, PATIENT_FIELD_ALIASES.referralName);
  const referralType = readString(row, PATIENT_FIELD_ALIASES.referralType);
  const insurance = compactInsurance({
    primaryInsurance,
    primaryPolicyNumber,
    primaryGroupNumber,
    secondaryInsurance,
    secondaryPolicyNumber,
    secondaryGroupNumber,
    policyNumber: primaryPolicyNumber,
    groupNumber: primaryGroupNumber,
    payor: primaryInsurance,
  });
  const hospiceFlag = readString(row, PATIENT_FIELD_ALIASES.hospiceFlag).toLowerCase();
  const hospiceMarked =
    hasHospiceMarker(rawName) ||
    hasHospiceMarker(lastName) ||
    insuranceLooksHospice(resolvedInsuranceName) ||
    textLooksHospice(facility) ||
    textLooksHospice(nursingAgency) ||
    ["yes", "true", "1", "y"].includes(hospiceFlag);

  const issues = [];
  if (!patientName) {
    issues.push({
      rowIndex,
      severity: "error" as const,
      code: "missing_patient_name",
      message: "Patient row is missing a usable patient name.",
      field: "patientName",
    });
  }

  const patientKey = patientId
    ? safeFirestoreId(patientId, "patient")
    : safeFirestoreId(`${patientName}-${dob || "no-dob"}`, "patient");

  const searchText = normalizeSearchText(
    [
      patientId,
      patientName,
      firstName,
      lastName,
      dob,
      readString(row, PATIENT_FIELD_ALIASES.phone),
      resolvedInsuranceName,
      primaryPolicyNumber,
      secondaryPolicyNumber,
      facility,
      nursingAgency,
      emergencyContact?.name,
      responsibleParty?.name,
    ].join(" ")
  );

  return {
    sourceRowId: `${importId}-${rowIndex}`,
    rowIndex,
    patientKey,
    patientId,
    patientName,
    firstName,
    lastName: stripHospiceMarker(lastName),
    dob,
    dateOfDeath,
    phone: readString(row, PATIENT_FIELD_ALIASES.phone),
    email: readString(row, PATIENT_FIELD_ALIASES.email),
    address: readString(row, PATIENT_FIELD_ALIASES.address),
    city: readString(row, PATIENT_FIELD_ALIASES.city),
    state: readString(row, PATIENT_FIELD_ALIASES.state),
    zip: readString(row, PATIENT_FIELD_ALIASES.zip),
    insuranceName: resolvedInsuranceName,
    customerType,
    facility,
    nursingAgency,
    emergencyContact,
    responsibleParty,
    insurance,
    primaryDoctor,
    orderingDoctor,
    referralName,
    referralType,
    searchText,
    hospiceMarked,
    issues,
    raw: row,
  };
}

export function readString(row: UnknownRow, aliases: readonly string[]): string {
  const direct = readDirectString(row, aliases);
  if (direct) return direct;

  const normalizedAliases = new Set(aliases.map(normalizeFieldKey));

  for (const [key, value] of Object.entries(row)) {
    if (!normalizedAliases.has(normalizeFieldKey(key))) continue;
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }

  return "";
}

function readDirectString(row: UnknownRow, aliases: readonly string[]): string {
  for (const alias of aliases) {
    const value = row[alias];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function normalizeFieldKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function stripHospiceMarker(value: string): string {
  return value.replace(/^\*+/, "").replace(/\*\s*$/, "").trim();
}

function hasHospiceMarker(value: string): boolean {
  const text = value.trim();
  return text.startsWith("*") || /\*\s*$/.test(text);
}

function insuranceLooksHospice(value: string): boolean {
  return textLooksHospice(value);
}

function textLooksHospice(value: string): boolean {
  const text = normalizeSearchText(value);
  return (
    text.includes("hospice") ||
    text.includes("hoaspice") ||
    text.includes("pennyroyal") ||
    text.includes("pennroyal")
  );
}

function compactContact(contact: PatientContactSnapshot): PatientContactSnapshot | undefined {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  const next = removeEmpty({ ...contact, name });
  return Object.keys(next).length ? next : undefined;
}

function compactInsurance(insurance: PatientInsuranceSnapshot): PatientInsuranceSnapshot | undefined {
  const next = removeEmpty(insurance);
  return Object.keys(next).length ? next : undefined;
}

function removeEmpty<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      return true;
    })
  ) as T;
}

function normalizeDate(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}
