import type { NormalizedPatientIdentity, RawImportRow } from "../types";
import { detectHospice } from "./hospice";
import {
  cleanKey,
  cleanText,
  normalizeKey,
  readFirstString,
  splitFullName,
} from "./utils";

export function normalizePatientIdentity(
  row: RawImportRow
): NormalizedPatientIdentity {
  const patientId = readFirstString(row, [
    "Patient ID",
    "PatientId",
    "Patient Id",
    "Patient Number",
    "Pt ID",
    "MRN",
  ]);

  const fullNameFromColumn =
    readFirstString(row, ["Patient Name", "Name", "Full Name", "Patient"]) ?? "";

  const firstNameFromColumn = readFirstString(row, [
    "First Name",
    "FirstName",
    "Patient First Name",
  ]);

  const lastNameFromColumn = readFirstString(row, [
    "Last Name",
    "LastName",
    "Patient Last Name",
  ]);

  const parsedName = splitFullName(fullNameFromColumn);

  const firstName = cleanText(firstNameFromColumn ?? parsedName.firstName);
  const lastName = cleanText(lastNameFromColumn ?? parsedName.lastName);

  const finalFullName =
    cleanText(fullNameFromColumn) ||
    [firstName, lastName].filter(Boolean).join(" ");

  const dob = readFirstString(row, [
    "DOB",
    "Date of Birth",
    "Patient DOB",
    "Birth Date",
  ]);

  const phone = readFirstString(row, [
    "Phone",
    "Patient Phone",
    "Home Phone",
    "Mobile Phone",
    "Telephone",
  ]);

  const dobKey = normalizeKey(dob ?? "no_dob");
  const nameKey = normalizeKey(finalFullName || `${firstName}_${lastName}`);

  const patientKey = patientId
    ? cleanKey(patientId)
    : normalizeKey(`${nameKey}_${dobKey}`);

  const hospice = detectHospice(row);

  return {
    patientId,
    firstName,
    lastName,
    fullName: finalFullName,
    dob,
    dobKey,
    nameKey,
    patientKey,
    phone,
    hospiceDetected: hospice.hospiceDetected,
    hospiceSourceField: hospice.hospiceSourceField,
    hospiceSourceValue: hospice.hospiceSourceValue,
  };
}