const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "advanced-home-medical-55772",
});

const db = admin.firestore();

async function count(name) {
  const snap = await db.collection(name).count().get();
  console.log(`${name}: ${snap.data().count}`);
}

async function main() {
  await count("patients");
  await count("patients_index");
  await count("hospicePatients");
  await count("orders");
  await count("rentals");

  const analyticsDocs = await db.collection("analytics").get();

  console.log("\nanalytics docs:");
  analyticsDocs.forEach((doc) => {
    console.log(doc.id, doc.data());
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
