import type {
  FirestoreIndexFields,
  NormalizedInsurance,
  NormalizedItem,
  NormalizedPatientIdentity,
  ReportType,
} from "../types";

type BuildFirestoreIndexFieldsParams = {
  reportType: ReportType;
  importedAtMs: number;
  patient: NormalizedPatientIdentity;
  item: NormalizedItem;
  insurance: NormalizedInsurance;
};

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function keyString(value: unknown): string {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function searchString(value: unknown): string {
  return cleanString(value).toLowerCase();
}

export function buildFirestoreIndexFields(
  params: BuildFirestoreIndexFieldsParams
): FirestoreIndexFields {
  const patientName = cleanString(params.patient.fullName);
  const patientId = cleanString(params.patient.patientId);
  const dob = cleanString(params.patient.dob);

  const patientSearchKey =
    searchString(patientName) ||
    searchString(patientId) ||
    "unknown-patient";

  const patientNameDobKey =
    keyString(`${patientName}-${dob}`) ||
    keyString(patientName) ||
    keyString(patientId) ||
    "unknown-patient-dob";

  const payorKey = params.insurance.payorKey || "unknown-payor";

  const hcpcsKey = params.item.hcpcsKey || "unknown-hcpcs";

  const searchTokens = Array.from(
    new Set(
      [
        patientName,
        patientId,
        dob,

        params.insurance.primaryPayor,
        params.insurance.secondaryPayor,
        params.insurance.policyNumber,

        params.item.itemName,
        params.item.sku,
        params.item.hcpcs,
        params.item.serialNumber,
      ]
        .map(searchString)
        .filter(Boolean)
    )
  );

  return {
    reportType: params.reportType,
    importedAtMs: params.importedAtMs,

    patientNameDobKey,
    patientSearchKey,

    payorKey,
    hcpcsKey,

    searchTokens,
  };
}