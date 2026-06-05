const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

async function main() {
  const jobs = await db.collection("importJobs").limit(20).get();

  for (const doc of jobs.docs) {
    const d = doc.data();
    const name = String(d.fileName || d.originalName || "");

    if (name.toLowerCase().includes("contact")) {
      console.log("IMPORT JOB:", doc.id);
      console.log({
        fileName: d.fileName,
        status: d.status,
        processingStatus: d.processingStatus,
        processingStage: d.processingStage,
        processedRows: d.processedRows,
        writtenRows: d.writtenRows,
        queuedTaskCount: d.queuedTaskCount,
        completedQueueJobs: d.completedQueueJobs,
        failedQueueJobs: d.failedQueueJobs,
        activeChunkCount: d.activeChunkCount,
        completedChunkCount: d.completedChunkCount,
        failedChunkCount: d.failedChunkCount,
        updatedAt: d.updatedAt,
      });
    }
  }

  const queue = await db
    .collection("importQueue")
    .where("status", "in", ["queued", "processing"])
    .limit(20)
    .get();

  console.log("ACTIVE QUEUE JOBS:", queue.size);

  queue.docs.forEach((doc) => {
    const d = doc.data();
    console.log({
      id: doc.id,
      importId: d.importId,
      status: d.status,
      chunkIndex: d.chunkIndex,
      updatedAt: d.updatedAt,
    });
  });
}

main().catch(console.error);
