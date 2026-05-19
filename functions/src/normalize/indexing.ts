import type {
  FirestoreIndexFields,
  NormalizedInsurance,
  NormalizedItem,
  NormalizedPatientIdentity,
  ReportType,
} from "../../lib/imports/types";
import { buildSearchTokens, cleanKey, safeFirestoreId } from "./utils";

export function buildFirestoreIndexFields(params: {
  reportType: ReportType;
  importedAtMs: number;
  patient: NormalizedPatientIdentity;
  item: NormalizedItem;
  insurance: NormalizedInsurance;
}): FirestoreIndexFields {
  const patientSearchKey = cleanKey(
    `${params.patient.lastName}_${params.patient.firstName}_${params.patient.dobKey ?? ""}`
  );

  return {
    searchTokens: buildSearchTokens([
      params.patient.firstName,
      params.patient.lastName,
      params.patient.fullName,
      params.patient.patientId ?? "",
      params.patient.dob ?? "",
      params.item.itemName ?? "",
      params.item.hcpcs ?? "",
      params.item.sku ?? "",
      params.item.serialNumber ?? "",
      params.insurance.primaryPayor ?? "",
      params.insurance.secondaryPayor ?? "",
    ]),
    patientSearchKey,
    patientNameDobKey: safeFirestoreId(
      `${params.patient.nameKey}_${params.patient.dobKey ?? "no_dob"}`
    ),
    hcpcsKey: params.item.hcpcsKey,
    payorKey: params.insurance.payorKey,
    reportType: params.reportType,
    importedAtMs: params.importedAtMs,
  };
}