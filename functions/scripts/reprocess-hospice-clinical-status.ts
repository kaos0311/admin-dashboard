import fs from "node:fs";

import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import Papa from "papaparse";

import type { ImportRow } from "../src/imports/types/stagingChunk";

const JOB_ID = "hospice-clinical-status-67cb43aa";
const FILE_PATH =
  "C:/Users/pboyl/Downloads/67cb43aa-f8e4-438a-ba15-0a51cf1eba83.csv";
const CHUNK_SIZE = 250;

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

async function main() {
  const { applyJarvisImportScreening } = await import("../src/ai/importScreening");
  const {
    buildImportRouteMap,
    detectReportContract,
    validateHeaders,
  } = await import("../src/imports/reportContracts");
  const { processHospice } = await import("../src/imports/processors/hospice");

  const fileName = FILE_PATH.split(/[\\/]/).pop() ?? "hospice-status.csv";
  const rows = readCsvRows(FILE_PATH);
  const headers = Object.keys(rows[0] ?? {});
  const contract = detectReportContract(fileName, headers);
  const headerValidation = validateHeaders(contract, headers);
  const importRoute = buildImportRouteMap(contract);
  const chunkCount = Math.ceil(rows.length / CHUNK_SIZE);

  await db.collection("importJobs").doc(JOB_ID).set(
    {
      id: JOB_ID,
      importId: JOB_ID,
      fileName,
      status: "processing",
      processingStatus: "direct_hospice_clinical_status",
      processingStage: "direct_hospice_clinical_status",
      reportType: contract.processor,
      detectedReportKind: contract.kind,
      detectedReportLabel: contract.label,
      headerValidation,
      importRoute,
      processors: ["hospice"],
      totalRows: rows.length,
      processedRows: 0,
      writtenRows: 0,
      skippedRows: 0,
      issueCount: 0,
      chunkCount,
      completedChunkCount: 0,
      failedChunkCount: 0,
      failedQueueJobs: 0,
      deadLetteredQueueJobs: 0,
      destinationSummary: FieldValue.delete(),
      jarvisScreening: FieldValue.delete(),
      error: null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  let issueCount = 0;
  let skippedCount = 0;
  let writtenCount = 0;

  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + CHUNK_SIZE);
    const result = await processHospice(JOB_ID, chunk, offset);
    issueCount += result.issueCount;
    skippedCount += result.skippedCount;
    writtenCount += result.writtenCount;
  }

  const status = issueCount > 0 ? "completed_with_errors" : "completed";

  await Promise.all([
    db.collection("importJobs").doc(JOB_ID).set(
      {
        status,
        processingStatus: "completed",
        processingStage: "completed",
        progressPercent: 100,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
    db.collection("importedReports").doc(JOB_ID).set(
      {
        status,
        reportType: contract.processor,
        detectedReportKind: contract.kind,
        detectedReportLabel: contract.label,
        fileName,
        totalRows: rows.length,
        processedRows: rows.length,
        writtenRows: writtenCount,
        skippedRows: skippedCount,
        issueCount,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ]);

  const screening = await applyJarvisImportScreening(JOB_ID);

  console.log(
    JSON.stringify(
      {
        jobId: JOB_ID,
        fileName,
        kind: contract.kind,
        rows: rows.length,
        written: writtenCount,
        skipped: skippedCount,
        issues: issueCount,
        jarvis: screening?.status,
        findings: screening?.findings ?? [],
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
