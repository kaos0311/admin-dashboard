const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

async function main() {
  const snap = await db
    .collection("patients")
    .where("phone", "!=", "")
    .limit(20)
    .get();

  console.log("matches:", snap.size);

  snap.docs.forEach((doc) => {
    const d = doc.data();

    console.log({
      patientId: d.patientId,
      patientName: d.patientName,
      phone: d.phone,
      email: d.email,
      address: d.address,
      city: d.city,
      state: d.state,
    });
  });
}

main().catch(console.error);
