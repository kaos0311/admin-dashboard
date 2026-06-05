const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

const ids = [
  "amvU8FyppYVLZQsm1p0M",
  "cmVwb3J0cy91cGxvYWRzL2FtdlU4RnlwcFlWTFpRc20xcDBNL1BhdGllbnRzX0NvbnRhY3QuY3N2OjE3ODA1OTc1OTIxMjU3ODg"
];

async function main() {
  for (const id of ids) {
    const doc = await db.collection("importJobs").doc(id).get();

    console.log("================================");
    console.log("ID:", id);

    if (!doc.exists) {
      console.log("MISSING");
      continue;
    }

    const d = doc.data();
    console.log(JSON.stringify(d, null, 2));
  }
}

main().catch(console.error);
