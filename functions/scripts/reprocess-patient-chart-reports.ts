import fs from "node:fs";

import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import Papa from "papaparse";

import type { ImportRow } from "../src/imports/types/stagingChunk";

const REPORTS = [
  {
    jobId: "DfCSmMTbCf1k0L2vijft",
    filePath: "C:/Users/pboyl/Downloads/Patients_Demographics.csv",
  },
  {
    jobId: "d0jrgBP766b1lLXlo2Iq",
    filePath: "C:/Users/pboyl/Downloads/Patients_Contact.csv",
  },
  {
    jobId: "wkIdq5Lw8hK1LPpZw6SJ",
    filePath: "C:/Users/pboyl/Downloads/Patient_Physicians.csv",
  },
  {
    jobId: "jWV0WODneuau8NXehrxl",
    filePath: "C:/Users/pboyl/Downloads/Patient_Referrals.csv",
  },
];

if (!getApps().length) {
  initializeApp({ projectId: "advanced-home-medical-55772" });
}

const db = getFirestore();

function readCsvRows(filePath: string): ImportRow[] {
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = Papa.parse<ImportRow>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? `Could not parse ${filePath}`);
  }

  return parsed.data.filter((row) =>
    Object.values(row).some((value) => String(value ?? "").trim())
  );
}

async function reprocessReport(jobId: string, filePath: string) {
  const { applyJarvisImportScreening } = await import("../src/ai/importScreening");
  const { detectReportContract, validateHeaders, buildImportRouteMap } = await import("../src/imports/reportContracts");
  const { processShop } = await import("../src/imports/processors/shop/shopProcessor");
  const fileName = filePath.split(/[\\/]/).pop() ?? "report.csv";
  const rows = readCsvRows(filePath);
  const headers = Object.keys(rows[0] ?? {});
  const contract = detectReportContract(fileName, headers);
  const headerValidation = validateHeaders(contract, headers);
  const importRoute = buildImportRouteMap(contract);

  await db.collection("importJobs").doc(jobId).set(
    {
      id: jobId,
      importId: jobId,
      fileName,
      status: "processing",
      processingStatus: "direct_patient_chart_remap",
      processingStage: "direct_patient_chart_remap",
      reportType: contract.processor,
      detectedReportKind: contract.kind,
      detectedReportLabel: contract.label,
      headerValidation,
      importRoute,
      totalRows: rows.length,
      processedRows: 0,
      writtenRows: 0,
      skippedRows: 0,
      issueCount: 0,
      failedQueueJobs: 0,
      deadLetteredQueueJobs: 0,
      destinationSummary: FieldValue.delete(),
      jarvisScreening: FieldValue.delete(),
      error: null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const result = await processShop(jobId, rows, 0);

  await Promise.all([
    db.collection("importJobs").doc(jobId).set(
      {
        status: result.issueCount > 0 ? "completed_with_errors" : "completed",
        processingStatus: "completed",
        processingStage: "completed",
        progressPercent: 100,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
    db.collection("importedReports").doc(jobId).set(
      {
        status: result.issueCount > 0 ? "completed_with_errors" : "completed",
        reportType: contract.processor,
        detectedReportKind: contract.kind,
        detectedReportLabel: contract.label,
        fileName,
        totalRows: rows.length,
        processedRows: result.processedCount,
        writtenRows: result.writtenCount,
        skippedRows: result.skippedCount,
        issueCount: result.issueCount,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ]);

  const screening = await applyJarvisImportScreening(jobId);

  console.log(
    JSON.stringify(
      {
        jobId,
        fileName,
        kind: contract.kind,
        rows: rows.length,
        written: result.writtenCount,
        skipped: result.skippedCount,
        issues: result.issueCount,
        jarvis: screening?.status,
        findings: screening?.findings ?? [],
      },
      null,
      2
    )
  );
}

async function main() {
  for (const report of REPORTS) {
    await reprocessReport(report.jobId, report.filePath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
