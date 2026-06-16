import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type WriteBatch } from "firebase-admin/firestore";
import * as fs from "node:fs";
import * as path from "node:path";
import Papa from "papaparse";

type ServiceAccountFile = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

type RentalRow = Record<string, string>;

type ReportPatient = {
  patientId: string;
  ptKey: string;
  patientName: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  address: string;
  insuranceName: string;
  equipment: string[];
  rentalItems: Record<string, unknown>[];
  searchText: string;
  lineCount: number;
};

const APPLY = process.argv.includes("--apply");
const FILE_ARG = process.argv.find((arg) => arg.toLowerCase().endsWith(".csv"));
const DEFAULT_FILE = "C:/Users/pboyl/Downloads/Active Rentals.csv";
const SOURCE_FILE = FILE_ARG ?? DEFAULT_FILE;
const HOSPICE_PAYOR = "Pennyroyal Hospice";
const SYNC_SOURCE = "active_rentals_source_of_truth";
const MAX_BATCH_SIZE = 400;

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

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .trim();
}

function parsePatientName(value: string) {
  const clean = value.replace(/\*/g, "").trim();

  if (clean.includes(",")) {
    const [last = "", first = ""] = clean.split(",");
    const firstName = titleCase(first.trim());
    const lastName = titleCase(last.trim());
    return {
      firstName,
      lastName,
      patientName: [firstName, lastName].filter(Boolean).join(" "),
    };
  }

  const parts = clean.split(/\s+/).filter(Boolean);
  const firstName = titleCase(parts.slice(0, -1).join(" "));
  const lastName = titleCase(parts.at(-1) ?? "");

  return {
    firstName,
    lastName,
    patientName: titleCase(clean),
  };
}

function isoDate(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

function normalize(value: string): string {
  return value
    .replace(/\*/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function activeStatus(data: FirebaseFirestore.DocumentData): boolean {
  const dod = text(data.dateOfDeath) || text(data.dod) || text(data.deathDate);
  if (dod) return false;

  const status = normalize(
    text(data.status) ||
      text(data.hospiceStatus) ||
      (data.active === true ? "active" : "")
  );

  return (
    status.includes("active") ||
    status.includes("living") ||
    status.includes("pending pickup") ||
    status.includes("pending pick up")
  );
}

function patientNameFromDoc(data: FirebaseFirestore.DocumentData): string {
  return (
    text(data.patientName) ||
    text(data.fullName) ||
    [text(data.firstName), text(data.lastName)].filter(Boolean).join(" ")
  );
}

function dobFromDoc(data: FirebaseFirestore.DocumentData): string {
  return (
    text(data.dob) ||
    text(data.dateOfBirth) ||
    text(data.birthDate) ||
    text(data.patientDob)
  );
}

function reportKeysForPatient(patient: ReportPatient): string[] {
  return [
    patient.patientId ? `id:${patient.patientId}` : "",
    patient.ptKey ? `ptkey:${patient.ptKey}` : "",
    patient.patientName && patient.dob
      ? `namedob:${normalize(patient.patientName)}|${patient.dob}`
      : "",
  ].filter(Boolean);
}

function keysForDoc(
  id: string,
  data: FirebaseFirestore.DocumentData
): string[] {
  const patientId = text(data.patientId) || id;
  const ptKey = text(data.ptKey);
  const name = patientNameFromDoc(data);
  const dob = isoDate(dobFromDoc(data));

  return [
    patientId ? `id:${patientId}` : "",
    ptKey ? `ptkey:${ptKey}` : "",
    name && dob ? `namedob:${normalize(name)}|${dob}` : "",
  ].filter(Boolean);
}

function parseRows(filePath: string): RentalRow[] {
  const parsed = Papa.parse<RentalRow>(fs.readFileSync(filePath, "utf8"), {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message ?? "CSV parse failed.");
  }

  return parsed.data;
}

function buildReportPatients(rows: RentalRow[]): ReportPatient[] {
  const map = new Map<string, ReportPatient>();

  for (const row of rows) {
    const patientId = text(row.PtID);
    if (!patientId) continue;

    const { firstName, lastName, patientName } = parsePatientName(text(row.PatientName));
    const dob = isoDate(text(row.PatientDOB));
    const key = patientId;
    const itemName = text(row.ItemName);
    const equipmentLabel = [
      itemName,
      text(row.ProcCode) ? `(${text(row.ProcCode)})` : "",
      text(row.SerialNum) ? `SN ${text(row.SerialNum)}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const rentalItem = {
      itemId: text(row.ItemID),
      itemName,
      itemGroup: text(row.ItemGroup),
      procCode: text(row.ProcCode),
      modifiers: text(row.Modifiers),
      serialNumber: text(row.SerialNum),
      salesOrderId: text(row.SalesOrderID),
      salesOrderDetailId: text(row.SalesOrderDetailID),
      originalDos: isoDate(text(row.OriginalDOS)),
      nextDos: isoDate(text(row.NextDOS)),
      quantity: Number(text(row.ItemQuantity)) || 1,
    };

    const existing = map.get(key);
    const patient = existing ?? {
      patientId,
      ptKey: text(row.PtKey),
      patientName,
      firstName,
      lastName,
      dob,
      phone: text(row.PatientPhone),
      address: text(row.PatientAddress),
      insuranceName: text(row.Insurance),
      equipment: [],
      rentalItems: [],
      searchText: "",
      lineCount: 0,
    };

    if (equipmentLabel && !patient.equipment.includes(equipmentLabel)) {
      patient.equipment.push(equipmentLabel);
    }

    patient.rentalItems.push(rentalItem);
    patient.lineCount += 1;
    patient.searchText = normalize(
      [
        patient.patientName,
        patient.patientId,
        patient.ptKey,
        patient.dob,
        patient.phone,
        patient.address,
        patient.insuranceName,
        patient.equipment.join(" "),
      ].join(" ")
    );

    map.set(key, patient);
  }

  return Array.from(map.values()).sort((a, b) =>
    a.patientName.localeCompare(b.patientName)
  );
}

async function commitBatches(batches: WriteBatch[]) {
  if (!APPLY) return;

  for (const batch of batches) {
    await batch.commit();
  }
}

async function main() {
  const serviceAccount = loadServiceAccount();

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: serviceAccount.projectId,
        clientEmail: serviceAccount.clientEmail,
        privateKey: serviceAccount.privateKey,
      }),
      projectId: serviceAccount.projectId,
    });
  }

  const db = getFirestore();
  const reportPatients = buildReportPatients(parseRows(SOURCE_FILE));
  const sourceKeys = new Set(reportPatients.flatMap(reportKeysForPatient));
  const activePatientSnap = await db.collection("patients").where("hospice", "==", true).get();
  const activeHospiceSnap = await db.collection("hospicePatients").get();
  const stalePatientDocs = activePatientSnap.docs.filter((doc) => {
    const data = doc.data();
    if (!activeStatus(data)) return false;
    return !keysForDoc(doc.id, data).some((key) => sourceKeys.has(key));
  });
  const staleHospiceDocs = activeHospiceSnap.docs.filter((doc) => {
    const data = doc.data();
    if (!activeStatus(data)) return false;
    return !keysForDoc(doc.id, data).some((key) => sourceKeys.has(key));
  });

  const batches: WriteBatch[] = [];
  let currentBatch = db.batch();
  let batchOps = 0;

  function addSet(
    ref: FirebaseFirestore.DocumentReference,
    data: FirebaseFirestore.DocumentData
  ) {
    if (batchOps >= MAX_BATCH_SIZE) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      batchOps = 0;
    }

    currentBatch.set(ref, cleanDoc(data), { merge: true });
    batchOps += 1;
  }

  for (const patient of reportPatients) {
    const base = {
      patientKey: patient.patientId,
      patientId: patient.patientId,
      ptKey: patient.ptKey,
      patientName: patient.patientName,
      fullName: patient.patientName,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dob: patient.dob,
      dateOfBirth: patient.dob,
      phone: patient.phone,
      address: patient.address,
      insuranceName: patient.insuranceName,
      hospice: true,
      hospiceMarked: true,
      hospiceStatus: "active",
      hospiceProvider: HOSPICE_PAYOR,
      payor: HOSPICE_PAYOR,
      currentEquipment: patient.rentalItems,
      currentEquipmentCount: patient.rentalItems.length,
      activeEquipment: patient.equipment,
      lastHospiceSourceOfTruth: SYNC_SOURCE,
      activeRentalsLineCount: patient.lineCount,
      searchText: patient.searchText,
      updatedAt: FieldValue.serverTimestamp(),
    };

    addSet(db.collection("patients").doc(patient.patientId), base);
    addSet(db.collection("patients_index").doc(patient.patientId), {
      ...base,
      currentEquipment: undefined,
      activeEquipment: undefined,
    });
    addSet(db.collection("hospicePatients").doc(patient.patientId), {
      hospiceKey: patient.patientId,
      patientKey: patient.patientId,
      patientId: patient.patientId,
      patientName: patient.patientName,
      dob: patient.dob,
      dateOfBirth: patient.dob,
      phone: patient.phone,
      address: patient.address,
      insuranceName: patient.insuranceName,
      hospiceProvider: HOSPICE_PAYOR,
      payor: HOSPICE_PAYOR,
      status: "active",
      hospiceStatus: "active",
      active: true,
      equipment: patient.equipment,
      rentalItems: patient.rentalItems,
      searchText: patient.searchText,
      hospiceSource: SYNC_SOURCE,
      activeRentalsLineCount: patient.lineCount,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  for (const doc of stalePatientDocs) {
    addSet(doc.ref, {
      hospice: false,
      hospiceMarked: false,
      hospiceStatus: "inactive",
      active: false,
      activeHospiceRemovedAt: FieldValue.serverTimestamp(),
      activeHospiceRemovedBy: SYNC_SOURCE,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  for (const doc of staleHospiceDocs) {
    addSet(doc.ref, {
      active: false,
      status: "discharged",
      hospiceStatus: "inactive",
      activeHospiceRemovedAt: FieldValue.serverTimestamp(),
      activeHospiceRemovedBy: SYNC_SOURCE,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  if (batchOps > 0) batches.push(currentBatch);

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        sourceFile: SOURCE_FILE,
        reportActiveHospicePatients: reportPatients.length,
        stalePatientDocs: stalePatientDocs.length,
        staleHospiceDocs: staleHospiceDocs.length,
        writeBatches: batches.length,
        writeOperations: reportPatients.length * 3 + stalePatientDocs.length + staleHospiceDocs.length,
        sampleReportPatients: reportPatients.slice(0, 10).map((patient) => ({
          patientId: patient.patientId,
          patientName: patient.patientName,
          dob: patient.dob,
          rentalLines: patient.lineCount,
        })),
        sampleStalePatients: stalePatientDocs.slice(0, 20).map((doc) => ({
          id: doc.id,
          patientName: patientNameFromDoc(doc.data()),
          dob: dobFromDoc(doc.data()),
        })),
      },
      null,
      2
    )
  );

  await commitBatches(batches);

  if (APPLY) {
    console.log("Active hospice source-of-truth sync applied.");
  }
}

function cleanDoc(data: FirebaseFirestore.DocumentData) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
