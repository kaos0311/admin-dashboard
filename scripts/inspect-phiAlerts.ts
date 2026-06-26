import fs from "fs";
import path from "path";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function readEnv(name: string): string {
  return typeof process.env[name] === "string" ? process.env[name].trim() : "";
}

function loadServiceAccount(): ServiceAccount {
  const envProjectId = readEnv("FIREBASE_PROJECT_ID");
  const envClientEmail = readEnv("FIREBASE_CLIENT_EMAIL");
  const envPrivateKey = readEnv("FIREBASE_PRIVATE_KEY");

  if (envProjectId && envClientEmail && envPrivateKey) {
    return {
      project_id: envProjectId,
      client_email: envClientEmail,
      private_key: envPrivateKey.replace(/\\n/g, "\n"),
    };
  }

  const candidates = [
    path.resolve(process.cwd(), "serviceAccountKey.json"),
    path.resolve(process.cwd(), "scripts", "serviceAccountKey.json"),
  ];

  const filePath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!filePath) {
    throw new Error(
      "Missing Firebase credentials. Provide serviceAccountKey.json or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    );
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as ServiceAccount;

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(
      "Invalid serviceAccountKey.json. It must include project_id, client_email, and private_key."
    );
  }

  return {
    project_id: parsed.project_id,
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

type PhiSummary = {
  id: string;
  severity: string;
  sourceCollection: string;
  sourceFieldPath: string;
  detectedTypes: string[];
  recommendation: string;
  findingTypes: string[];
};

async function inspectAlerts(db: ReturnType<typeof getFirestore>): Promise<PhiSummary[]> {
  const snap = await db
    .collection("phiAlerts")
    .where("status", "==", "open")
    .limit(500)
    .get();

  if (snap.empty) {
    console.log("No open phiAlerts.");
    return [];
  }

  return snap.docs
    .sort((left, right) => {
      const leftUpdatedAt = left.get("updatedAt");
      const rightUpdatedAt = right.get("updatedAt");
      const leftMillis =
        leftUpdatedAt && typeof leftUpdatedAt.toMillis === "function"
          ? leftUpdatedAt.toMillis()
          : 0;
      const rightMillis =
        rightUpdatedAt && typeof rightUpdatedAt.toMillis === "function"
          ? rightUpdatedAt.toMillis()
          : 0;

      return rightMillis - leftMillis;
    })
    .slice(0, 40)
    .map((doc) => {
    const data = doc.data();
    const findings = Array.isArray(data.findings) ? data.findings : [];
    return {
      id: doc.id,
      severity: typeof data.severity === "string" ? data.severity : "unknown",
      sourceCollection: typeof data.sourceCollection === "string" ? data.sourceCollection : "",
      sourceFieldPath: typeof data.sourceFieldPath === "string" ? data.sourceFieldPath : "",
      detectedTypes: Array.isArray(data.detectedTypes) ? data.detectedTypes : [],
      recommendation: typeof data.recommendation === "string" ? data.recommendation : "",
      findingTypes: findings.map((finding) => (typeof finding.type === "string" ? finding.type : "unknown")),
    };
  });
}

async function batchDeleteAlerts(db: ReturnType<typeof getFirestore>, ids: string[]): Promise<void> {
  const BATCH_SIZE = 450;
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const batch = db.batch();
    const slice = ids.slice(start, start + BATCH_SIZE);

    for (const id of slice) {
      batch.delete(db.collection("phiAlerts").doc(id));
    }

    await batch.commit();
  }
}

async function main() {
  const serviceAccount = loadServiceAccount();

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount as any),
      projectId: serviceAccount.project_id,
    });
  }

  const db = getFirestore();
  serviceAccount.project_id;

  const action = process.argv[2] ?? "inspect";

  if (action === "inspect") {
    const summary = await inspectAlerts(db);
    console.log(JSON.stringify({ count: summary.length, summary }, null, 2));
    return;
  }

  if (action === "clear-open") {
    const summary = await inspectAlerts(db);

    if (!summary.length) {
      console.log("Nothing to clear.");
      return;
    }

    const dryRun = process.argv[3] !== "--force";
    const ids = summary.map((item) => item.id);

    if (dryRun) {
      console.log(`DRY RUN: would delete ${ids.length} open phiAlert(s).`);
      console.log("Rerun with --force to confirm.");
      console.log(JSON.stringify({ count: summary.length, ids }, null, 2));
      return;
    }

    console.log(`Deleting ${ids.length} open phiAlert(s)...`);
    await batchDeleteAlerts(db, ids);
    console.log(`Deleted ${ids.length} open phiAlert(s). Rerun inspect to verify.`);
    return;
  }

  console.log("Usage:");
  console.log("  tsx scripts/inspect-phiAlerts.ts inspect");
  console.log("  tsx scripts/inspect-phiAlerts.ts clear-open");
  console.log("  tsx scripts/inspect-phiAlerts.ts clear-open --force");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
