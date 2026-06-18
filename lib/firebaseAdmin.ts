import { readFileSync } from "node:fs";
import path from "node:path";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type ServiceAccountFile = {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
};

function loadServiceAccount() {
  const serviceAccountPath = path.resolve(process.cwd(), "serviceAccountKey.json");
  const raw = JSON.parse(readFileSync(serviceAccountPath, "utf8")) as ServiceAccountFile;

  return {
    projectId: raw.project_id ?? raw.projectId ?? "",
    clientEmail: raw.client_email ?? raw.clientEmail ?? "",
    privateKey: raw.private_key ?? raw.privateKey ?? "",
  };
}

if (!getApps().length) {
  const serviceAccount = loadServiceAccount();

  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.projectId,
  });
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
