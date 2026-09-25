import { FieldValue, getFirestore } from "firebase-admin/firestore";

import { applyJarvisImportScreening } from "../../ai/importScreening";
import { updatePatientAnalytics } from "../analytics/updatePatientAnalytics";
import { updateOrderAnalytics } from "../analytics/updateOrderAnalytics";
import { updateHospiceAnalytics } from "../analytics/updateHospiceAnalytics";

const db = getFirestore();

type QueueCounts = {
  total: number;
  ready: number;
  active: number;
  complete: number;
  deadLettered: number;
  failed: number;
  other: number;
};

function inferReportType(processors: string[]): string {
  if (processors.includes("patients")) return "patients";
  if (processors.includes("hospice")) return "hospice";
  if (processors.includes("orders")) return "orders";
  return processors[0] || "generic";
}

export async function finalizeImportQueueIfDone(importId: string): Promise<void> {
  const queueSnap = await db
    .collection("importQueue")
    .where("importId", "==", importId)
    .get();

  if (queueSnap.empty) return;

  const counts: QueueCounts = {
    total: queueSnap.size,
    ready: 0,
    active: 0,
    complete: 0,
    deadLettered: 0,
    failed: 0,
    other: 0,
  };

  const processors = new Set<string>();

  for (const doc of queueSnap.docs) {
    const data = doc.data();
    const status = String(data.status || "unknown");
    const processor = String(data.processor || "");

    if (processor) processors.add(processor);

    if (status === "ready") counts.ready += 1;
    else if (status === "active") counts.active += 1;
    else if (status === "complete") counts.complete += 1;
    else if (status === "dead_lettered") counts.deadLettered += 1;
    else if (status === "failed") counts.failed += 1;
    else counts.other += 1;
  }

  const unfinished = counts.ready + counts.active + counts.other;
  if (unfinished > 0) return;

  const jobRef = db.collection("importJobs").doc(importId);
  const jobSnap = await jobRef.get();
  const job = jobSnap.data() || {};

  const processorList = Array.from(processors);
  const reportType = inferReportType(processorList);

  const fileName = String(
    job.fileName || job.originalName || job.originalFileName || "Unknown import"
  );
  const fileType = String(job.fileType || job.ext || "csv");

  const completedCleanly =
    counts.complete === counts.total &&
    counts.deadLettered === 0 &&
    counts.failed === 0;

  if (completedCleanly) {
    await Promise.all([
      jobRef.set(
        {
          status: "completed",
          processingStatus: "completed",
          processingStage: "completed",
          progressPercent: 100,
          totalQueueJobs: counts.total,
          completedQueueJobs: counts.complete,
          failedQueueJobs: 0,
          deadLetteredQueueJobs: 0,
          error: null,
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      ),

      db.collection("importedReports").doc(importId).set(
        {
          status: "completed",
          reportType,
          processors: processorList,
          fileName,
          fileType,
          totalQueueJobs: counts.total,
          completedQueueJobs: counts.complete,
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      ),
    ]);

    await Promise.all([
      applyJarvisImportScreening(importId),
      updatePatientAnalytics(),
      updateOrderAnalytics(),
      updateHospiceAnalytics(),
    ]);

    return;
  }

  await Promise.all([
    jobRef.set(
      {
        status: "failed",
        processingStatus: "failed",
        processingStage: "failed",
        progressPercent: 100,
        totalQueueJobs: counts.total,
        completedQueueJobs: counts.complete,
        failedQueueJobs: counts.failed,
        deadLetteredQueueJobs: counts.deadLettered,
        error: "One or more import queue jobs failed or were dead-lettered.",
        failedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),

    db.collection("importedReports").doc(importId).set(
      {
        status: "failed",
        reportType,
        processors: processorList,
        fileName,
        fileType,
        totalQueueJobs: counts.total,
        completedQueueJobs: counts.complete,
        failedQueueJobs: counts.failed,
        deadLetteredQueueJobs: counts.deadLettered,
        error: "One or more import queue jobs failed or were dead-lettered.",
        failedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ]);

  await applyJarvisImportScreening(importId);
}
