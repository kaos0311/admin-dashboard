const fs = require("fs");
const path = require("path");
const admin = require("../functions/node_modules/firebase-admin");

const COLLECTIONS_TO_CLEAR = [
  "importJobs",
  "importQueue",
  "patients",
  "patients_index",
  "hospicePatients",
  "insurancePatients",
  "products",
  "orders",
  "rentals",
  "inventory",
  "insurance",
  "insuranceRecords",
  "patientPhysicians",
  "patientReferrals",
  "patientAuthorizations",
  "insuranceQueue",
  "wipRecords",
  "rolodexContacts",
  "hcpcsCodes",
  "shopItems",
  "shopInventoryLots",
  "shopInventorySerials",
  "shopGlAccountGroups",
  "shopGlDetails",
  "shopCostOfGoodsSold",
  "shopRawReports",
  "analytics",
  "searchIndex",
  "dataQualityIssues",
] ;

const BATCH_SIZE = 100;

function loadServiceAccount() {
  const possiblePaths = [
    path.resolve(process.cwd(), "serviceAccountKey.json"),
    path.resolve(process.cwd(), "scripts/serviceAccountKey.json"),
    path.resolve(process.cwd(), "functions/serviceAccountKey.json"),
  ];

  const filePath = possiblePaths.find((candidate) => fs.existsSync(candidate));

  if (!filePath) {
    throw new Error(
      `Missing service account key. Checked: ${possiblePaths.join(", ")}`
    );
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key,
  };
}

async function deleteCollection(db, collectionName) {
  let deleted = 0;

  while (true) {
    const snap = await db.collection(collectionName).limit(BATCH_SIZE).get();

    if (snap.empty) {
      return deleted;
    }

    const batch = db.batch();

    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      deleted += 1;
    }

    await batch.commit();
  }
}

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(loadServiceAccount()),
      storageBucket: "advanced-home-medical-55772.firebasestorage.app",
    });
  }

  const db = admin.firestore();
  const results = {};

  for (const collectionName of COLLECTIONS_TO_CLEAR) {
    const deleted = await deleteCollection(db, collectionName);
    results[collectionName] = deleted;
    console.log(`${collectionName}: deleted ${deleted}`);
  }

  console.log("Reset results:");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error("Reset failed:", error);
  process.exit(1);
});
