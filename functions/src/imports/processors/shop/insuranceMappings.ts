import type { ImportRow } from "../../types/stagingChunk";
import type { BulkSetInput } from "../../utils/bulkWriter";
import { safeFirestoreId } from "../../utils/hash";
import {
  compactRemittanceAddress,
  clean,
  normalizeStatus,
  read,
  toBoolean,
  toNumber,
} from "./shopRowUtils";

export function insuranceWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const insuranceKey = read(row, ["cokey", "payorkey", "PayorCo"]) ||
    read(row, ["insurance", "PayorGrp", "Insurance Company Name"]);
  const insuranceName = read(row, ["insurance", "Insurance Company Name"]);
  if (!insuranceKey && !insuranceName) return [];

  const id = safeFirestoreId(insuranceKey || insuranceName, "insurance");
  const data = clean({
    insuranceKey,
    insuranceName,
    payerName: insuranceName,
    payerCompany: read(row, ["PayorCo", "Insurance Company Name"]),
    description: read(row, ["Insurance Company Description"]),
    payerGroup: read(row, ["PayorGrp"]),
    groupingName: read(row, ["insgroupingname"]),
    planType: read(row, ["PlanType"]),
    priceTable: read(row, ["PriceTable"]),
    claimForm: read(row, ["claimform"]),
    branch: read(row, ["branch"]),
    submitterId: read(row, ["submitterid"]),
    providerNumber: read(row, ["providernbr"]),
    claimProgram: read(row, ["ClaimPrg"]),
    ecsName: read(row, ["ECSName"]),
    holdAccount: toBoolean(read(row, ["HoldAccount"])),
    payPercentage: toNumber(read(row, ["PayPercentage"])),
    submissionType: read(row, ["SubmissionTypeName"]),
    autoCrossover: toBoolean(read(row, ["AutoCrossover"])),
    medigap: read(row, ["Medigap"]),
    remittanceAddress: compactRemittanceAddress(row),
    coverageTypes: read(row, ["PayorCoverageTypeNames"]),
    insuranceStatus: read(row, ["InsuranceStatus"]),
    status: normalizeStatus(read(row, ["InsuranceStatus"])),
    source: read(row, ["Insurance Company Name"]) ? "adhoc_insurance_company_master" : "adhoc_insurance",
    raw: row,
    lastImportId: importId,
  });

  return [
    { path: "insurance", id, data },
    { path: "insuranceRecords", id, data },
  ];
}
