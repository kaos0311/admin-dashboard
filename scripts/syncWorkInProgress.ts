import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import Papa from "papaparse";

import type { ImportRow } from "../functions/src/imports/types/stagingChunk";

type ServiceAccountFile = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

const APPLY = process.argv.includes("--apply");
const FILE_ARG = process.argv.find((arg) => arg.toLowerCase().endsWith(".csv"));
const DEFAULT_FILE = "C:/Users/pboyl/Downloads/Work In Progress (2).csv";
const SOURCE_FILE = FILE_ARG ?? DEFAULT_FILE;
const IMPORT_ID = `manual-wip-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const CHUNK_SIZE = 250;

function loadServiceAccount() {
  const envProjectId = process.env.FIREBASE_PROJECT_ID;
  const envClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const envPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (envProjectId && envClientEmail && envPrivateKey) {
    return {
      projectId: envProjectId,
      clientEmail: envClientEmail,
      privateKey: envPrivateKey.replace(/\\n/g, "\n"),
    };
  }

  const filePath = path.resolve(process.cwd(), "serviceAccountKey.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing serviceAccountKey.json at ${filePath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as ServiceAccountFile;
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error("Invalid Firebase service account.");
  }

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

async function initializeFirebaseAdmin() {
  const requireFromFunctions = createRequire(
    path.resolve(process.cwd(), "functions", "package.json")
  );
  const appAdmin = requireFromFunctions("firebase-admin/app") as typeof import("firebase-admin/app");
  const firestoreAdmin = requireFromFunctions("firebase-admin/firestore") as typeof import("firebase-admin/firestore");

  if (appAdmin.getApps().length) return firestoreAdmin;

  const serviceAccount = loadServiceAccount();

  appAdmin.initializeApp({
    credential: appAdmin.cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
    }),
  });

  return firestoreAdmin;
}

function parseRows(filePath: string): ImportRow[] {
  const parsed = Papa.parse<ImportRow>(fs.readFileSync(filePath, "utf8"), {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message ?? "CSV parse failed.");
  }

  return parsed.data;
}

async function main() {
  if (!fs.existsSync(SOURCE_FILE)) {
    throw new Error(`WIP CSV not found: ${SOURCE_FILE}`);
  }

  const firestoreAdmin = await initializeFirebaseAdmin();
  const { processShop } = await import(
    "../functions/src/imports/processors/shop/shopProcessor"
  );

  const rows = parseRows(SOURCE_FILE);
  const uniquePatients = new Set(
    rows.map((row) => String(row.PatientID ?? row.PtKey ?? "").trim()).filter(Boolean)
  );
  const uniqueOrders = new Set(
    rows.map((row) => String(row.SOKey ?? "").trim()).filter(Boolean)
  );

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        importId: IMPORT_ID,
        sourceFile: SOURCE_FILE,
        rows: rows.length,
        uniquePatients: uniquePatients.size,
        uniqueOrders: uniqueOrders.size,
      },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to write to Firestore.");
    return;
  }

  const db = firestoreAdmin.getFirestore();
  await db.collection("importJobs").doc(IMPORT_ID).set(
    {
      id: IMPORT_ID,
      fileName: path.basename(SOURCE_FILE),
      sourceFileName: path.basename(SOURCE_FILE),
      reportType: "wip",
      selectedReportType: "wip",
      status: "processing",
      totalRows: rows.length,
      createdAt: new Date(),
      updatedAt: new Date(),
      manuallySynced: true,
    },
    { merge: true }
  );

  let processedCount = 0;
  let skippedCount = 0;
  let issueCount = 0;

  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + CHUNK_SIZE);
    const result = await processShop(IMPORT_ID, chunk, offset);

    processedCount += result.processedCount;
    skippedCount += result.skippedCount;
    issueCount += result.issueCount;
    console.log(`Processed ${Math.min(offset + CHUNK_SIZE, rows.length)} / ${rows.length}`);
  }

  await db.collection("importJobs").doc(IMPORT_ID).set(
    {
      status: "completed",
      processedCount,
      skippedCount,
      issueCount,
      completedAt: new Date(),
      updatedAt: new Date(),
    },
    { merge: true }
  );

  console.log(
    JSON.stringify(
      {
        importId: IMPORT_ID,
        processedCount,
        skippedCount,
        issueCount,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
