const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "advanced-home-medical-55772",
});

const db = admin.firestore();

async function main() {
  const importId = process.argv[2];

  if (!importId) {
    console.error("Usage: node scripts/count-import-queue.cjs IMPORT_JOB_ID");
    process.exit(1);
  }

  const snap = await db
    .collection("importQueue")
    .where("importId", "==", importId)
    .get();

  const counts = {};

  for (const doc of snap.docs) {
    const status = doc.data().status || "missing_status";
    counts[status] = (counts[status] || 0) + 1;
  }

  console.log("Import ID:", importId);
  console.log("Total queue docs:", snap.size);
  console.log(counts);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
