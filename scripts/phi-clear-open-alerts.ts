import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import { readFileSync } from "fs";
import { resolve } from "path";

function loadServiceAccount() {
  const candidates = [
    resolve(process.cwd(), "serviceAccountKey.json"),
    resolve(process.cwd(), "scripts", "serviceAccountKey.json"),
  ];
  const filePath = candidates.find((candidate) =>
    require("fs").existsSync(candidate)
  );
  if (!filePath) {
    throw new Error(
      "Missing serviceAccountKey.json. Place it at project root or under scripts/"
    );
  }
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

async function main() {
  const serviceAccount = loadServiceAccount();
  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  }
  const db = getFirestore();

  const snap = await db
    .collection("phiAlerts")
    .where("status", "==", "open")
    .limit(500)
    .get();

  console.log(`Open phiAlerts: ${snap.size}`);

  const ids = snap.docs.map((doc) => doc.id);
  if (!ids.length) {
    console.log("No open phiAlerts to clear.");
    return;
  }

  const dryRun = process.argv[2] === "--inspect" || process.argv[2] === "inspect";

  if (dryRun) {
    console.log(`DRY RUN: would clear ${ids.length} open phiAlert(s).`);
    console.log("Rerun with --force to confirm.");
    return;
  }

  const BATCH_SIZE = 450;
  let processed = 0;
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const batch = db.batch();
    const slice = ids.slice(start, start + BATCH_SIZE);

    for (const id of slice) {
      batch.update(db.collection("phiAlerts").doc(id), {
        status: "cleared_by_script",
        recommendation: "Marked cleared by phi-clear script.",
        correctiveMeasures: [
          "Review whether the flagged field legitimately stores patient-specific data.",
          "Move real PHI to the patient chart or protected document store.",
          "Retain operational records as redacted/minimum-necessary text only.",
          "Re-run the PHI scan after cleanup.",
        ],
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    processed += slice.length;
    console.log(`Updated ${processed}/${ids.length}`);
  }

  console.log(`Cleared ${processed} phiAlert(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
