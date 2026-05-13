import { processHospiceFromRows } from "./hospiceProcessor.js";
import { processOrdersFromRows } from "./orderProcessor.js";
import { processPatientsFromRows } from "./patientProcessor.js";

interface ProcessorParams {
  importId: string;
  reportType: string;
  fileName: string;
  storagePath: string;
  rows: Array<{
    rowNumber?: number;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
}

export async function runProcessors(params: ProcessorParams): Promise<void> {
  const reportType = params.reportType.toLowerCase();

  await processPatientsFromRows(params);

  if (
    reportType.includes("order") ||
    reportType.includes("delivery") ||
    reportType.includes("sales") ||
    reportType.includes("ticket")
  ) {
    await processOrdersFromRows(params);
  }

  if (
    reportType.includes("hospice") ||
    reportType.includes("patient") ||
    reportType.includes("delivery") ||
    reportType.includes("order")
  ) {
    await processHospiceFromRows(params);
  }
}