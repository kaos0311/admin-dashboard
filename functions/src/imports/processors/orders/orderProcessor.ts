import type { ProcessorResult } from "../../types/processorResult";
import type { ImportRow } from "../../types/stagingChunk";
import { writeImportIssues } from "../../issues/writeImportIssues";
import { filterRowsToImportRetentionWindow } from "../../../importRetention";
import { normalizeOrderRow } from "./orderNormalize";
import { updateOrderProgress } from "./orderProgress";
import { writeOrders } from "./orderWriter";

export async function processOrders(
  importId: string,
  rows: ImportRow[],
  rowOffset = 0
): Promise<ProcessorResult> {
  const retainedRows = filterRowsToImportRetentionWindow(rows);
  const retentionSkippedCount = rows.length - retainedRows.length;
  const normalized = retainedRows.map((row, index) =>
    normalizeOrderRow(row, rowOffset + index, importId)
  );

  const valid = normalized.filter((row) => row.orderId || row.patientName || row.itemName);
  const issues = normalized
    .filter((row) => !row.orderId && !row.patientName && !row.itemName)
    .map((row) => ({
      rowIndex: row.rowIndex,
      severity: "warning" as const,
      code: "missing_order_patient_item_identifier",
      message:
        "Order row did not include a usable order, patient, or item identifier.",
    }));
  const skippedCount = normalized.length - valid.length;
  const writtenCount = await writeOrders(valid);

  await writeImportIssues(importId, "orders", issues);
  await updateOrderProgress(importId, {
    processed: retainedRows.length,
    written: writtenCount,
    skipped: skippedCount + retentionSkippedCount,
    issues: issues.length,
  });

  return {
    processor: "orders",
    processedCount: retainedRows.length,
    writtenCount,
    skippedCount: skippedCount + retentionSkippedCount,
    issueCount: issues.length,
    issues,
  };
}
