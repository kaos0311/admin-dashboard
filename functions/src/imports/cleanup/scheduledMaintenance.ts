import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { cleanupCompletedImports } from "./cleanupCompletedImports";
import { cleanupDeadChunks } from "./cleanupDeadChunks";
import { requeueDeadLetters } from "../reprocess/requeueDeadLetters";

const db = getFirestore();

export const scheduledImportCleanup = onSchedule(
  {
    schedule: "every 24 hours",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "256MiB",
    maxInstances: 1,
  },
  async () => {
    logger.info("Scheduled import cleanup started.");

    // Clean up staging chunks for completed imports older than 14 days
    const stagingCleaned = await cleanupCompletedImports(14);
    logger.info(`Staging chunks cleaned: ${stagingCleaned}`);

    // Find import jobs with dead-lettered queue items and clean their chunks
    const deadLetteredJobs = await db
      .collection("importJobs")
      .where("deadLetteredQueueJobs", ">", 0)
      .where("status", "in", ["failed", "completed_with_errors"])
      .select()
      .get();

    for (const job of deadLetteredJobs.docs) {
      const chunkCount = await cleanupDeadChunks(job.id);
      if (chunkCount > 0) {
        logger.info(`Cleaned ${chunkCount} dead chunks for job ${job.id}`);
      }

      const requeueCount = await requeueDeadLetters(job.id);
      if (requeueCount > 0) {
        logger.info(`Requeued ${requeueCount} dead letters for job ${job.id}`);
      }
    }

    // Find stale jobs (stuck in "active" status for more than 2 hours) and mark them
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const staleJobs = await db
      .collection("importJobs")
      .where("status", "==", "active")
      .where("updatedAt", "<", twoHoursAgo)
      .get();

    for (const job of staleJobs.docs) {
      await job.ref.set(
        {
          status: "failed",
          processingStatus: "stale_timeout",
          error: "Job was stuck in active status for more than 2 hours. Auto-staled.",
          updatedAt: new Date(),
        },
        { merge: true }
      );
      logger.warn(`Auto-staled job ${job.id} (active > 2 hours)`);
    }

    logger.info("Scheduled import cleanup completed.");
  }
);
