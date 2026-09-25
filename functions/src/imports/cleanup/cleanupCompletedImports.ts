import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { cleanupStagingChunks } from "../staging/cleanupStagingChunks";

const db = getFirestore();

export async function cleanupCompletedImports(daysOld = 14): Promise<number> {
  const cutoff = Timestamp.fromMillis(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  const jobs = await db
    .collection("importJobs")
    .where("status", "in", ["completed", "complete", "completed_with_errors"])
    .where("completedAt", "<", cutoff)
    .limit(25)
    .get();

  let cleaned = 0;
  for (const job of jobs.docs) {
    cleaned += await cleanupStagingChunks(job.id);
  }

  return cleaned;
}
