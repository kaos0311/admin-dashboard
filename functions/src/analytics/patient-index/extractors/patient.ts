import type {
  InsuranceSnapshot,
  PatientProfile
} from "../types";

import {
  normalizeIsoDate,
  parseFullName,
  titleCase,
  valueFromAliases
} from "../utils";
export function extractPatient(row: Record<string, unknown>) {
  const fullNameRaw = valueFromAliases(row, [
    "fullname",
    "full_name",
    "patient_name",
    "ptname",
    "patientfullname",
    "patient_full_name",
    "PatientName",
    "Patient Name",
    "Customer",
    "Customer Name",
    "Name",
  ]);

  const parsed = parseFullName(fullNameRaw);

  const fallbackFirst = titleCase(
    valueFromAliases(row, [
      "first_name",
      "firstname",
      "first name",
      "patient_first_name",
      "fname",
    ])
  );

  const fallbackLast = titleCase(
    valueFromAliases(row, [
      "last_name",
      "lastname",
      "last name",
      "patient_last_name",
      "lname",
    ])
  );

  const firstName = parsed.firstName || fallbackFirst;
  const lastName = parsed.lastName || fallbackLast;

  const dateOfBirth = normalizeIsoDate(
    valueFromAliases(row, [
      "dob",
      "date_of_birth",
      "date of birth",
      "birth_date",
      "DateOfBirth",
      "DOB",
    ])
  );

  const dateOfDeath = normalizeIsoDate(
    valueFromAliases(row, [
      "dod",
      "date_of_death",
      "date of death",
      "death_date",
      "DateOfDeath",
      "DOD",
    ])
  );

  return {
    firstName,
    lastName,
    dateOfBirth,
    dateOfDeath,
    fullName: parsed.fullName || [firstName, lastName].filter(Boolean).join(" "),
    sourceFullName: parsed.sourceFullName,
    phone: valueFromAliases(row, [
      "phone",
      "phone_number",
      "mobile",
      "patient_phone",
      "PhoneNumber",
      "Customer Phone",
    ]),
    email: valueFromAliases(row, [
      "email",
      "email_address",
      "patient_email",
      "EmailAddress",
    ]),
    address: valueFromAliases(row, [
      "address",
      "street_address",
      "patient_address",
      "Address1",
      "Bill To",
      "Deliver To",
    ]),
    city: valueFromAliases(row, ["city", "patient_city"]),
    state: valueFromAliases(row, ["state", "patient_state"]),
    zip: valueFromAliases(row, ["zip", "zipcode", "zip_code", "postal_code"]),
  };
}

export function extractPatientProfile(row: Record<string, unknown>): PatientProfile {
  const diagnosisRaw = valueFromAliases(row, [
    "TopFourDiagCodes",
    "SODiagCodes",
    "Diagnosis Codes",
    "DiagCodes",
    "diagnosis",
  ]);

  return {
    patientId: valueFromAliases(row, [
      "PtID",
      "Patient ID",
      "PatientId",
      "Customer ID",
      "CustomerID",
    ]),
    patientKey: valueFromAliases(row, ["PtKey", "PatientKey"]),
    accountNumber: valueFromAliases(row, [
      "AcctNo",
      "AccountNumber",
      "Account Number",
      "Acct No",
    ]),
    sex: valueFromAliases(row, ["sex", "gender", "Sex"]),
    height: valueFromAliases(row, ["height", "Height"]),
    weight: valueFromAliases(row, ["weight", "Weight"]),
    patientStatus: valueFromAliases(row, [
      "PatientStatus",
      "Patient Status",
      "status",
    ]),
    patientHubStatus: valueFromAliases(row, [
      "Patient Hub Status",
      "PatientHubStatus",
      "HubStatus",
    ]),
    registrationDate: normalizeIsoDate(
      valueFromAliases(row, ["Registration Date", "RegistrationDate"])
    ),
    lastLoginDate: normalizeIsoDate(
      valueFromAliases(row, ["Last Login Date", "LastLoginDate"])
    ),
    primaryDoctor: valueFromAliases(row, [
      "PrimaryDocname",
      "Primary Doctor",
      "PrimaryDocName",
    ]),
    orderingDoctor: valueFromAliases(row, [
      "OrderingDocname",
      "Ordering Doctor",
      "OrderingDocName",
    ]),
    diagnosisCodes: diagnosisRaw
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12),
  };
}

export function extractInsurance(row: Record<string, unknown>): InsuranceSnapshot {
  return {
    primaryInsurance: valueFromAliases(row, [
      "PrimaryInsuranceName",
      "Primary Insurance",
      "Insurance",
      "insurance",
    ]),
    secondaryInsurance: valueFromAliases(row, [
      "SecondaryInsuranceName",
      "Secondary Insurance",
    ]),
    policyNumber: valueFromAliases(row, [
      "PolicyNbr",
      "Policy Number",
      "policy",
    ]),
    insuranceStatus: valueFromAliases(row, [
      "InsuranceStatus",
      "Insurance Status",
    ]),
    coverageTypes: valueFromAliases(row, [
      "PayorCoverageTypeNames",
      "Coverage Type",
      "Coverage Types",
    ]),
    payor: valueFromAliases(row, [
      "Payor",
      "PayorName",
      "Payer",
      "PayerName",
      "payor",
      "payer",
    ]),
  };
}




