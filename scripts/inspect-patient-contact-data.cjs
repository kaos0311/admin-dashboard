const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

async function main() {
  const snap = await db.collection("patients").limit(10).get();

  snap.docs.forEach((doc) => {
    const d = doc.data();

    console.log("================================");
    console.log(d.patientName);
    console.log("phone:", d.phone);
    console.log("email:", d.email);
    console.log("address:", d.address);
    console.log("city:", d.city);
    console.log("state:", d.state);
  });
}

main().catch(console.error);
