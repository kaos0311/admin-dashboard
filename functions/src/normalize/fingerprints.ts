import { shortHash, stableJson } from "../../lib/imports/hash";
import type {
  ImportFingerprint,
  NormalizedFinancials,
  NormalizedInsurance,
  NormalizedItem,
  NormalizedPatientIdentity,
  RawImportRow,
  ReportType,
} from "../../lib/imports/types";

export function buildImportFingerprint(params: {
  row: RawImportRow;
  reportType: ReportType;
  sourceFileId: string;
  sourceRowNumber: number;
  patient: NormalizedPatientIdentity;
  item: NormalizedItem;
  financials: NormalizedFinancials;
  insurance: NormalizedInsurance;
}): ImportFingerprint {
  const sourceRowHash = shortHash(stableJson(params.row), 32);

  const duplicateBase = [
    params.reportType,
    params.sourceFileId,
    params.patient.patientKey,
    params.patient.dobKey ?? "no_dob",
    params.item.hcpcsKey,
    params.item.itemKey,
    params.item.serialNumber,
    params.financials.chargeAmount,
    params.financials.allowedAmount,
    params.financials.paidAmount,
    params.financials.balanceAmount,
    params.insurance.payorKey,
  ].join("|");

  return {
    sourceRowHash,
    duplicateKey: shortHash(duplicateBase, 40),
  };
}