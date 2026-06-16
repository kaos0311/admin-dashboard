import fs from "fs";
import path from "path";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import { DEFAULT_BRIGHTREE_REFERENCES } from "../app/(admin)/settings/brightree-reference-data";

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function loadServiceAccount() {
  const envProjectId = readEnv("FIREBASE_PROJECT_ID");
  const envClientEmail = readEnv("FIREBASE_CLIENT_EMAIL");
  const envPrivateKey = readEnv("FIREBASE_PRIVATE_KEY");

  if (envProjectId && envClientEmail && envPrivateKey) {
    return {
      projectId: envProjectId,
      clientEmail: envClientEmail,
      privateKey: envPrivateKey.replace(/\\n/g, "\n"),
    };
  }

  const possiblePaths = [
    path.resolve(process.cwd(), "serviceAccountKey.json"),
    path.resolve(process.cwd(), "scripts", "serviceAccountKey.json"),
  ];

  const filePath = possiblePaths.find((candidate) => fs.existsSync(candidate));

  if (!filePath) {
    throw new Error(
      "Missing Firebase credentials. Add serviceAccountKey.json or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    );
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(
      "Invalid serviceAccountKey.json. It must include project_id, client_email, and private_key."
    );
  }

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
  const settingsRef = db.collection("settings").doc("app");

  await settingsRef.set(
    {
      brightreeReferences: DEFAULT_BRIGHTREE_REFERENCES,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "seedBrightreeReferences",
    },
    { merge: true }
  );

  await settingsRef.update({
    "brightreeReferences.facilities": FieldValue.delete(),
  });

  const recordCount = Object.values(DEFAULT_BRIGHTREE_REFERENCES).reduce(
    (total, records) => total + records.length,
    0
  );

  console.log(
    `Seeded ${recordCount} Brightree reference records into settings/app.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
