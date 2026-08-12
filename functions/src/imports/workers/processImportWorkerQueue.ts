import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { claimQueueJob } from "../queues/claimQueueJob";
import { finalizeImportQueueIfDone } from "../queues/finalizeImportQueue";
import { retryQueueJob } from "../queues/retryQueueJob";
import { processActiveRentalsWorker } from "./processActiveRentalsWorker";
import { processHospiceWorker } from "./processHospiceWorker";
import { processOrderWorker } from "./processOrderWorker";
import { processPatientWorker } from "./processPatientWorker";
import { processShopWorker } from "./processShopWorker";

const db = getFirestore();

export const processImportWorkerQueue = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "1GiB",
    maxInstances: 3,
  },
  async () => {
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const maxJobsPerRun = 50;

    logger.info("Import worker queue started.", { workerId, maxJobsPerRun });

    for (let i = 0; i < maxJobsPerRun; i += 1) {
      const job = await claimQueueJob(workerId);

      if (!job) {
        logger.info("No ready import queue jobs found.", { workerId });
        return;
      }

      try {
        logger.info("Processing import queue job.", {
          workerId,
          queueJobId: job.id,
          importId: job.importId,
          chunkId: job.chunkId,
          processor: job.processor,
        });

        if (job.processor === "patients") {
          await processPatientWorker(job.importId, job.chunkId);
        } else if (job.processor === "hospice") {
          await processHospiceWorker(job.importId, job.chunkId);
        } else if (job.processor === "orders") {
          await processOrderWorker(job.importId, job.chunkId);
        } else if (job.processor === "shop") {
          await processShopWorker(job.importId, job.chunkId);
        } else if (job.processor === "active_rentals") {
          await processActiveRentalsWorker(job.importId, job.chunkId);
        } else {
          throw new Error(`Unknown processor: ${job.processor}`);
        }

        await db.collection("importQueue").doc(job.id).set(
          {
            status: "complete",
            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        logger.info("Import queue job completed.", {
          workerId,
          queueJobId: job.id,
          importId: job.importId,
          chunkId: job.chunkId,
          processor: job.processor,
        });

        await finalizeImportQueueIfDone(job.importId);
      } catch (error) {
        logger.error("Import queue job failed.", {
          workerId,
          queueJobId: job.id,
          importId: job.importId,
          chunkId: job.chunkId,
          processor: job.processor,
          error: error instanceof Error ? error.message : String(error),
        });

        await retryQueueJob(job.id, error);
        await finalizeImportQueueIfDone(job.importId);
      }
    }

    logger.info("Import worker queue finished max run.", { workerId });
  }
);

