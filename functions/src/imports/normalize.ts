import type { NormalizedImportRow, RawImportRow, ReportType } from "./types";
import { buildImportFingerprint } from "./normalize/fingerprints";
import { normalizeFinancials } from "./normalize/financials";
import { buildFirestoreIndexFields } from "./normalize/indexing";
import { normalizeInsurance } from "./normalize/insurance";
import { normalizeItem } from "./normalize/item";
import { normalizePatientIdentity } from "./normalize/patient";
import { safeFirestoreId } from "./normalize/utils";

export { buildImportFingerprint } from "./normalize/fingerprints";
export { normalizeFinancials } from "./normalize/financials";
export { detectHospice } from "./normalize/hospice";
export { buildFirestoreIndexFields } from "./normalize/indexing";
export { normalizeInsurance } from "./normalize/insurance";
export { normalizeItem } from "./normalize/item";
export { normalizePatientIdentity } from "./normalize/patient";

export function normalizeImportRow(params: {
  row: RawImportRow;
  reportType: ReportType;
  sourceFileId: string;
  sourceFileName: string;
  sourceRowNumber: number;
  importedAtMs?: number;
}): NormalizedImportRow {
  const importedAtMs = params.importedAtMs ?? Date.now();

  const patient = normalizePatientIdentity(params.row);
  const financials = normalizeFinancials(params.row);
  const insurance = normalizeInsurance(params.row);
  const item = normalizeItem(params.row);

  const fingerprint = buildImportFingerprint({
    row: params.row,
    reportType: params.reportType,
    sourceFileId: params.sourceFileId,
    sourceRowNumber: params.sourceRowNumber,
    patient,
    item,
    financials,
    insurance,
  });

  const index = buildFirestoreIndexFields({
    reportType: params.reportType,
    importedAtMs,
    patient,
    item,
    insurance,
  });

  const id = safeFirestoreId(
    `${params.reportType}_${params.sourceFileId}_${fingerprint.duplicateKey}`
  );

  return {
    id,
    reportType: params.reportType,
    sourceFileId: params.sourceFileId,
    sourceFileName: params.sourceFileName,
    sourceRowNumber: params.sourceRowNumber,
    patient,
    financials,
    insurance,
    item,
    fingerprint,
    index,
    raw: params.row,
    createdAtMs: importedAtMs,
    updatedAtMs: importedAtMs,
  };
}