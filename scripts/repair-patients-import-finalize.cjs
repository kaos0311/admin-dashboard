const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "advanced-home-medical-55772",
});

const db = admin.firestore();

const importId = "cmVwb3J0cy91cGxvYWRzL0x5TVVveG5uaHp1V0t4Q1Jsa0tYL1BhdGllbnRzX0RlbW9ncmFwaGljcy5jc3Y6MTc4MDU3OTUzNDQ3OTc4MQ";

async function main() {
  const queueSnap = await db.collection("importQueue").where("importId", "==", importId).get();

  const counts = {};
  for (const doc of queueSnap.docs) {
    const status = doc.data().status || "missing";
    counts[status] = (counts[status] || 0) + 1;
  }

  console.log("Queue counts:", counts);

  const hasIncomplete = queueSnap.docs.some((doc) => doc.data().status !== "complete");

  if (hasIncomplete) {
    throw new Error("Not all queue jobs are complete. Refusing to mark import completed.");
  }

  await db.collection("importJobs").doc(importId).set(
    {
      status: "completed",
      processingStatus: "completed",
      processingStage: "completed",
      progressPercent: 100,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      repairReason: "Queue jobs were complete but parent import job was still queued.",
    },
    { merge: true }
  );

  await db.collection("importedReports").doc(importId).set(
    {
      status: "completed",
      reportType: "patients",
      fileName: "Patients_Demographics.csv",
      fileType: "csv",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      repairReason: "Created after import queue completed but report record was missing.",
    },
    { merge: true }
  );

  console.log("Repair complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
