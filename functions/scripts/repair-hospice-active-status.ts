import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({ projectId: "advanced-home-medical-55772" });
}

const db = getFirestore();

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function dateOfDeath(data: FirebaseFirestore.DocumentData): string {
  return (
    text(data.dateOfDeath) ||
    text(data.dod) ||
    text(data.DOD) ||
    text(data.deathDate) ||
    text(data.date_of_death)
  );
}

async function main() {
  const hospiceSnap = await db.collection("hospicePatients").get();
  let checked = 0;
  let repaired = 0;

  for (const hospiceDoc of hospiceSnap.docs) {
    checked += 1;
    const patientDoc = await db.collection("patients").doc(hospiceDoc.id).get();
    const hospiceData = hospiceDoc.data();
    const patientData = patientDoc.data() ?? {};
    const dod = dateOfDeath(patientData) || dateOfDeath(hospiceData);
    const currentStatus = text(hospiceData.status).toLowerCase();
    const source = text(hospiceData.hospiceSource);
    const nameText = [
      text(hospiceData.patientName),
      text(patientData.patientName),
      text(patientData.fullName),
    ].join(" ").toLowerCase();
    const shouldBeDeceased = Boolean(dod);

    if (
      shouldBeDeceased &&
      (hospiceData.active !== false || currentStatus !== "deceased")
    ) {
      await hospiceDoc.ref.set(
        {
          active: false,
          status: "deceased",
          dateOfDeath: dod,
          dod,
          statusRepairedAt: FieldValue.serverTimestamp(),
          statusRepairSource: "patients_dod_crosscheck",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      repaired += 1;
      continue;
    }

    if (
      !shouldBeDeceased &&
      source === "adhoc_identifier" &&
      currentStatus === "active"
    ) {
      const status = nameText.includes("do not use") ? "discharged" : "unknown";

      await hospiceDoc.ref.set(
        {
          active: false,
          status,
          statusRepairedAt: FieldValue.serverTimestamp(),
          statusRepairSource: "removed_generated_active_status",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      repaired += 1;
    }
  }

  console.log(`Checked ${checked} hospice records. Repaired ${repaired}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
