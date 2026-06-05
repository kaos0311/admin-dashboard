const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

async function main() {
  const snap = await db.collection("importJobs").limit(50).get();

  snap.docs.forEach((doc) => {
    const d = doc.data();
    const name = String(d.originalName || d.fileName || d.sourceFileName || "");

    if (name.toLowerCase().includes("contact")) {
      console.log({
        id: doc.id,
        originalName: d.originalName,
        fileName: d.fileName,
        sourceFileName: d.sourceFileName,
        status: d.status,
        reportType: d.reportType,
        rowsProcessed: d.rowsProcessed,
        rowsInserted: d.rowsInserted,
        rowsUpdated: d.rowsUpdated,
      });
    }
  });
}

main().catch(console.error);
