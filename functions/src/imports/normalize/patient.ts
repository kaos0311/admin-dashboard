import type { NormalizedPatientIdentity, RawImportRow } from "../types";
import { safeFirestoreId } from "./utils";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function lower(value: unknown): string {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

function get(row: RawImportRow, keys: string[]): string {
  for (const key of keys) {
    const value = clean(row[key]);
    if (value) return value;
  }

  return "";
}

export function normalizePatientIdentity(
  row: RawImportRow
): NormalizedPatientIdentity {
  const firstName = get(row, [
    "firstName",
    "First Name",
    "Patient First Name",
    "Pt First Name",
  ]);

  const lastName = get(row, [
    "lastName",
    "Last Name",
    "Patient Last Name",
    "Pt Last Name",
  ]);

  const patientId = get(row, [
    "patientId",
    "Patient ID",
    "Patient Number",
    "Patient #",
    "Account Number",
    "Acct",
    "Account",
  ]);

  const fullName =
    get(row, [
      "patientName",
      "Patient Name",
      "Patient",
      "Name",
      "Full Name",
    ]) || [firstName, lastName].filter(Boolean).join(" ");

  const dob = get(row, [
    "dob",
    "DOB",
    "dateOfBirth",
    "Date of Birth",
    "Birth Date",
  ]);

  const nameKey = safeFirestoreId(fullName || "unknown-patient");
  const patientKey = safeFirestoreId(patientId || `${fullName}_${dob}`);

  return {
    patientId,
    patientName: fullName,
    firstName,
    lastName,
    dateOfBirth: dob,

    patientKey,
    fullName,
    nameKey,
    dob,

    displayName: fullName || "Unknown Patient",
    normalizedName: lower(fullName),
    searchName: lower(fullName),
  } as unknown as NormalizedPatientIdentity;
}

export function normalizePatient(row: RawImportRow): NormalizedPatientIdentity {
  return normalizePatientIdentity(row);
}