import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import Papa from "papaparse";

import { createImportQueue } from "./queues/createImportQueue";
import { resolveProcessors } from "./resolveProcessors";
import { writeStagingChunks } from "./staging/writeStagingChunks";
import type { ImportRow } from "./types/stagingChunk";

const STORAGE_BUCKET = "advanced-home-medical-55772.firebasestorage.app";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

export const importFileFromStorage = onObjectFinalized(
  {
    region: "us-central1",
    bucket: STORAGE_BUCKET,
    timeoutSeconds: 540,
    memory: "1GiB",
    maxInstances: 2,
  },
  async (event) => {
    const object = event.data;
    const storagePath = object.name ?? "";

    console.log(
      `IMPORT TRIGGER FIRED bucket=${object.bucket ?? ""} name=${storagePath} contentType=${
        object.contentType ?? ""
      } size=${object.size ?? ""}`
    );

    console.log(`PATH CHECK ${storagePath}`);

    if (
      !storagePath.startsWith("reports/uploads/") &&
      !storagePath.startsWith("imports/")
    ) {
      console.log(`SKIPPED FILE ${storagePath}`);
      return;
    }

    const fileName = storagePath.split("/").pop() ?? "import.csv";
    const importId = buildImportId(storagePath, object.generation);

    console.log(`BEFORE IMPORT JOB ${importId}`);

    await db.collection("importJobs").doc(importId).set(
      {
        id: importId,
        importId,
        storagePath,
        fileName,
        reportType: "auto",
        status: "active",
        totalRows: 0,
        processedRows: 0,
        writtenRows: 0,
        skippedRows: 0,
        issueCount: 0,
        chunkCount: 0,
        activeChunkCount: 0,
        completedChunkCount: 0,
        failedChunkCount: 0,
        attemptCount: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`AFTER IMPORT JOB ${importId}`);

    try {
      const rows = await readCsvRows(storagePath);

      console.log(`ROWS READ ${rows.length}`);

      const processors = resolveProcessors(fileName, undefined, rows);

      console.log(`PROCESSORS ${processors.join(",")}`);

      const chunkCount = await writeStagingChunks(importId, rows, 250);

      console.log(`CHUNKS WRITTEN ${chunkCount}`);

      const queueCount = await createImportQueue(
        importId,
        chunkCount,
        processors
      );

      console.log(`QUEUE CREATED ${queueCount}`);

      await db.collection("importJobs").doc(importId).set(
        {
          status: "queued",
          processors,
          totalRows: rows.length,
          chunkCount,
          queuedTaskCount: queueCount,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`IMPORT JOB QUEUED ${importId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.error(`IMPORT FAILED ${importId}: ${message}`);

      await db.collection("importJobs").doc(importId).set(
        {
          status: "failed",
          error: message,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      throw error;
    }
  }
);

async function readCsvRows(storagePath: string): Promise<ImportRow[]> {
  const bucket = getStorage().bucket(STORAGE_BUCKET);
  const [buffer] = await bucket.file(storagePath).download();
  const text = buffer.toString("utf8");

  const parsed = Papa.parse<ImportRow>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parsed.errors.length > 0) {
    throw new Error(
      `CSV parse failed: ${parsed.errors[0]?.message ?? "Unknown parse error"}`
    );
  }

  return parsed.data.filter((row) =>
    Object.values(row).some((value) => String(value ?? "").trim())
  );
}

function buildImportId(
  storagePath: string,
  generation?: string | number
): string {
  return Buffer.from(`${storagePath}:${generation ?? Date.now()}`)
    .toString("base64url")
    .slice(0, 120);
}
