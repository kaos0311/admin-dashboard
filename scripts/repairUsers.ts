import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function loadServiceAccount(): ServiceAccount {
  const filePath = path.resolve(process.cwd(), "serviceAccountKey.json");

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing serviceAccountKey.json at ${filePath}. Download it from Firebase Console > Project Settings > Service accounts.`
    );
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as ServiceAccount;
}

async function main() {
  const serviceAccount = loadServiceAccount();

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    });
  }

  const db = getFirestore();
  const usersRef = db.collection("users");
  const snapshot = await usersRef.get();

  if (snapshot.empty) {
    console.log("No user documents found.");
    return;
  }

  let updatedCount = 0;
  let skippedCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const updates: Record<string, unknown> = {};
    let needsUpdate = false;

    if (typeof data.email !== "string") {
      updates.email = "";
      needsUpdate = true;
    }

    if (typeof data.displayName !== "string") {
      updates.displayName = "";
      needsUpdate = true;
    }

    if (typeof data.role !== "string") {
      updates.role = "staff";
      needsUpdate = true;
    }

    if (!("createdAt" in data) || data.createdAt == null) {
      updates.createdAt = FieldValue.serverTimestamp();
      needsUpdate = true;
    }

    if (!("updatedAt" in data) || data.updatedAt == null) {
      updates.updatedAt = FieldValue.serverTimestamp();
      needsUpdate = true;
    }

    if (needsUpdate) {
      await docSnap.ref.set(updates, { merge: true });
      updatedCount++;
      console.log(`Updated user: ${docSnap.id}`, updates);
    } else {
      skippedCount++;
      console.log(`Skipped user: ${docSnap.id}`);
    }
  }

  console.log("\nDone.");
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
}

main().catch((error) => {
  console.error("Repair failed:", error);
  process.exit(1);
});