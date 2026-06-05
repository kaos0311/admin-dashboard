const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "advanced-home-medical-55772",
});

const db = admin.firestore();

async function countCollection(name) {
  const snap = await db.collection(name).limit(25).get();
  console.log(`\n${name}: ${snap.size} sample docs`);

  for (const doc of snap.docs) {
    const data = doc.data();
    console.log({
      id: doc.id,
      status: data.status,
      fileName: data.fileName || data.originalName || data.originalFileName || data.name,
      importId: data.importId,
      chunkId: data.chunkId,
      processor: data.processor,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
    });
  }
}

async function main() {
  await countCollection("importJobs");
  await countCollection("importQueue");
  await countCollection("importedReports");
  await countCollection("patients");
  await countCollection("patients_index");
}

main().catch((error) => {
  console.error("Inspection failed:", error);
  process.exit(1);
});
