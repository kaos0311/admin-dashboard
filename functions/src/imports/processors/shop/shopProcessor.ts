import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { ProcessorResult, RowIssue } from "../../types/processorResult";
import type { ImportRow } from "../../types/stagingChunk";
import { writeImportIssues } from "../../issues/writeImportIssues";
import { bulkSetDocuments, type BulkSetInput } from "../../utils/bulkWriter";
import { safeFirestoreId, stableHash } from "../../utils/hash";
import { incrementImportProgress } from "../../utils/progressTracker";
import { filterRowsToImportRetentionWindow } from "../../../importRetention";
import {
  buildImportRouteMap,
  detectReportContract,
  validateHeaders,
} from "../../reportContracts";
import { cogsWrites, glAccountGroupWrites, glDetailWrites } from "./financialMappings";
import {
  itemDetailWrites,
  lotNumberWrites,
  serialAvailabilityWrites,
} from "./inventoryMappings";
import { insuranceWrites } from "./insuranceMappings";
import { parReportWrites, workInProgressWrites } from "./authorizationMappings";
import { arActivityByPatientWrites } from "./arMappings";
import {
  patientContactWrites,
  patientDemographicWrites,
  patientPhysicianWrites,
  patientReferralWrites,
} from "./patientMappings";

const db = getFirestore();

type ShopReportKind =
  | "patient_demographics"
  | "patient_contact"
  | "patient_physicians"
  | "patient_referrals"
  | "ar_activity_by_patient"
  | "item_detail"
  | "lot_numbers"
  | "serial_number_availability"
  | "insurance"
  | "par_report"
  | "work_in_progress"
  | "gl_account_groups"
  | "gl_detail"
  | "cost_of_goods_sold"
  | "unknown";

export async function processShop(
  importId: string,
  rows: ImportRow[],
  rowOffset = 0
): Promise<ProcessorResult> {
  const job = await db.collection("importJobs").doc(importId).get();
  const fileName = String(job.data()?.fileName ?? "");
  const retainedRows = filterRowsToImportRetentionWindow(rows);
  const retentionSkippedCount = rows.length - retainedRows.length;
  const headers = Object.keys(retainedRows[0] ?? rows[0] ?? {});
  const contract = detectReportContract(fileName, headers);
  const kind: ShopReportKind =
    contract.processor === "shop"
      ? (contract.kind as ShopReportKind)
      : "unknown";
  const headerValidation = validateHeaders(contract, headers);
  const importRoute = buildImportRouteMap(contract);
  const issues: RowIssue[] = [];
  const writes: BulkSetInput[] = [];
  let mappedRows = 0;

  retainedRows.forEach((row, index) => {
    const rowIndex = rowOffset + index;
    const rowWrites = buildWritesForRow(kind, row, importId, rowIndex);

    if (rowWrites.length === 0) {
      issues.push({
        rowIndex,
        severity: "warning",
        code: "unsupported_shop_report_row",
        message: `No shop import mapping matched this ${kind} row.`,
      });
      return;
    }

    mappedRows += 1;
    writes.push(...rowWrites);
  });

  const writtenCount = await bulkSetDocuments(writes, {
    batchSize: 350,
    throttleMs: 25,
  });
  const destinationSummary = buildDestinationSummary(
    writes,
    retainedRows.length,
    issues.length
  );
  const skippedCount = retainedRows.length - mappedRows;

  await Promise.all([
    writeImportIssues(importId, "shop", issues),
    db.collection("importJobs").doc(importId).set(
      {
      detectedReportKind: kind,
      detectedReportLabel: contract.label,
      headerValidation,
      importRoute,
      updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
    incrementImportProgress(importId, {
      processedRows: retainedRows.length,
      writtenRows: mappedRows,
      skippedRows: skippedCount + retentionSkippedCount,
      issueCount: issues.length,
      destinationSummary,
    }),
  ]);

  return {
    processor: "shop",
    processedCount: retainedRows.length,
    writtenCount,
    skippedCount: skippedCount + retentionSkippedCount,
    issueCount: issues.length,
    issues,
  };
}

function buildDestinationSummary(
  writes: BulkSetInput[],
  processedRows: number,
  issueCount: number
): Record<string, { processed: number; written: number; skipped?: number; issues?: number }> {
  const summary = writes.reduce<Record<string, { processed: number; written: number; skipped?: number; issues?: number }>>((summary, write) => {
    summary[write.path] = {
      processed: processedRows,
      written: (summary[write.path]?.written ?? 0) + 1,
    };

    return summary;
  }, {});

  if (issueCount > 0) {
    summary.unmappedRows = {
      processed: processedRows,
      written: 0,
      skipped: issueCount,
      issues: issueCount,
    };
  }

  return summary;
}

function buildWritesForRow(
  kind: ShopReportKind,
  row: ImportRow,
  importId: string,
  rowIndex: number
): BulkSetInput[] {
  switch (kind) {
    case "patient_demographics":
      return patientDemographicWrites(row, importId);
    case "patient_contact":
      return patientContactWrites(row, importId);
    case "patient_physicians":
      return patientPhysicianWrites(row, importId);
    case "patient_referrals":
      return patientReferralWrites(row, importId);
    case "ar_activity_by_patient":
      return arActivityByPatientWrites(row, importId);
    case "item_detail":
      return itemDetailWrites(row, importId);
    case "lot_numbers":
      return lotNumberWrites(row, importId);
    case "serial_number_availability":
      return serialAvailabilityWrites(row, importId);
    case "insurance":
      return insuranceWrites(row, importId);
    case "par_report":
      return parReportWrites(row, importId, rowIndex);
    case "work_in_progress":
      return workInProgressWrites(row, importId);
    case "gl_account_groups":
      return glAccountGroupWrites(row, importId);
    case "gl_detail":
      return glDetailWrites(row, importId, rowIndex);
    case "cost_of_goods_sold":
      return cogsWrites(row, importId, rowIndex);
    default:
      return rawShopReportWrites(row, importId, rowIndex);
  }
}

function rawShopReportWrites(row: ImportRow, importId: string, rowIndex: number): BulkSetInput[] {
  return [{
    path: "shopRawReports",
    id: safeFirestoreId(`${importId}-${rowIndex}-${stableHash(row).slice(0, 12)}`, "shop-row"),
    data: { importId, rowIndex, raw: row },
  }];
}
