const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");

initializeApp();

async function main() {
  const bucket = getStorage().bucket("advanced-home-medical-55772.firebasestorage.app");
  const file = bucket.file("reports/uploads/amvU8FyppYVLZQsm1p0M/Patients_Contact.csv");

  const [buffer] = await file.download();
  const text = buffer.toString("utf8");

  const firstLine = text.split(/\r?\n/)[0];
  console.log(firstLine);
}

main().catch(console.error);
