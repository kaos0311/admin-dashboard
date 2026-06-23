import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as csvParse } from "papaparse";

import { adminDb } from "../lib/firebaseAdmin";
import { CPAP_SUPPLY_RULES } from "../app/(admin)/reports/patients/lib/cpapEligibility";

type ParRow = {
  PatientName: string;
  PatientID: string;
  PatientPhone: string;
  PatientDOB: string;
  SalesOrderDtlProcCode: string;
  SalesOrderDtlItemName: string;
  Insurance: string;
  PARNumber: string;
  PARExpiration: string;
  parstatus: string;
  SalesOrderStatus: string;
};

type ParItem = {
  hcpc: string;
  itemName: string;
  insurance: string;
  parNumber: string;
  parExpiration: string;
  parStatus: string;
};

type ParPatient = {
  name: string;
  id: string;
  phone: string;
  dob: string;
  items: ParItem[];
};

type FirestorePatient = {
  found: boolean;
  id?: string;
  fullName?: string;
  hasCpapEquipment?: boolean;
  hasCpapOnRecord?: boolean;
  currentEquipmentCount?: number;
  matchingEquipment?: string[];
  missingEquipment?: string[];
};

type Result = {
  parPatient: ParPatient;
  firestorePatient: FirestorePatient;
};

const CPAP_HCPCS = new Set(
  CPAP_SUPPLY_RULES.flatMap((rule: { hcpcs: string[] }) => rule.hcpcs.map((h: string) => h.toUpperCase()))
);

const PAR_CSV_PATH = path.resolve(
  "c:/Users/pboyl/Downloads/PAR Report.csv"
);

async function main(): Promise<void> {
  console.log("=== CPAP PAR Report Cross-Reference ===\n");

  // 1. Parse PAR CSV
  const raw = readFileSync(PAR_CSV_PATH, "utf-8");
  const parsed = csvParse<ParRow>(raw, { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  console.log(`Total PAR rows: ${rows.length}`);

  // 2. Filter to CPAP-related rows and group by patient
  const cpapRows = rows.filter((r: ParRow) => {
    const code = (r.SalesOrderDtlProcCode || "").toUpperCase().trim();
    return CPAP_HCPCS.has(code);
  });
  console.log(`CPAP-related PAR rows: ${cpapRows.length}`);

  const byPatient = new Map<string, ParPatient>();
  for (const row of cpapRows) {
    const key = row.PatientID || row.PatientName.trim();
    if (!key) continue;
    if (!byPatient.has(key)) {
      byPatient.set(key, {
        name: row.PatientName?.trim() || "",
        id: row.PatientID?.trim() || "",
        phone: row.PatientPhone?.trim() || "",
        dob: row.PatientDOB?.trim() || "",
        items: [],
      });
    }
    byPatient.get(key)!.items.push({
      hcpc: (row.SalesOrderDtlProcCode || "").toUpperCase().trim(),
      itemName: (row.SalesOrderDtlItemName || "").trim(),
      insurance: (row.Insurance || "").trim(),
      parNumber: (row.PARNumber || "").trim(),
      parExpiration: (row.PARExpiration || "").trim(),
      parStatus: (row.parstatus || "").trim(),
    });
  }
  console.log(`Unique CPAP patients from PAR: ${byPatient.size}\n`);

  // 3. Query each patient in Firestore
  const results: Result[] = [];

  let found = 0;
  let notFound = 0;
  let missingEquipment = 0;

  for (const [, parPatient] of byPatient) {
    let docData: { id: string; data: FirebaseFirestore.DocumentData } | null = null;

    // Try to find patient by ID first
    if (parPatient.id) {
      const docRef = adminDb.collection("patients").doc(parPatient.id);
      const doc = await docRef.get();
      if (doc.exists) {
        docData = { id: doc.id, data: doc.data()! };
      }
    }

    // Try by name if ID didn't work
    if (!docData) {
      const nameQuery = await adminDb
        .collection("patients")
        .where("fullName", "==", parPatient.name)
        .limit(1)
        .get();

      if (!nameQuery.empty) {
        const doc = nameQuery.docs[0];
        docData = { id: doc.id, data: doc.data()! };
      }
    }

    if (!docData) {
      results.push({
        parPatient,
        firestorePatient: { found: false },
      });
      notFound++;
      continue;
    }

    const data = docData.data;
    const currentEquip: Array<{ hcpc?: string; itemName?: string }> = data.currentEquipment || [];
    const hcpcsInRecord = new Set(
      currentEquip.map((e: { hcpc?: string }) => (e.hcpc || "").toUpperCase().trim())
    );

    const matching: string[] = [];
    const missing: string[] = [];
    for (const item of parPatient.items) {
      if (hcpcsInRecord.has(item.hcpc)) {
        matching.push(`${item.hcpc} (${item.itemName})`);
      } else {
        // Try by keyword in item name
        const foundByName = currentEquip.some((e: { itemName?: string }) => {
          const name = (e.itemName || "").toLowerCase();
          const parName = item.itemName.toLowerCase();
          return name.includes(parName) || parName.includes(name);
        });
        if (foundByName) {
          matching.push(`${item.hcpc} (${item.itemName})`);
        } else {
          missing.push(`${item.hcpc} (${item.itemName})`);
        }
      }
    }

    results.push({
      parPatient,
      firestorePatient: {
        found: true,
        id: docData.id,
        fullName: data.fullName,
        hasCpapEquipment: data.cpap?.onRecord === true || currentEquip.length > 0,
        hasCpapOnRecord: data.cpap?.onRecord === true,
        currentEquipmentCount: currentEquip.length,
        matchingEquipment: matching,
        missingEquipment: missing,
      },
    });
    found++;
    if (missing.length > 0) missingEquipment++;
  }

  // 4. Output Report
  console.log("=== RESULTS ===");
  console.log(`Total CPAP patients from PAR: ${byPatient.size}`);
  console.log(`Found in Firestore: ${found}`);
  console.log(`Not found in Firestore: ${notFound}`);
  console.log(`Found but missing equipment records: ${missingEquipment}\n`);

  if (notFound > 0) {
    console.log("--- PATIENTS NOT IN FIRESTORE ---");
    for (const r of results) {
      if (!r.firestorePatient.found) {
        console.log(`  ${r.parPatient.name} (ID: ${r.parPatient.id || "N/A"})`);
        for (const item of r.parPatient.items) {
          console.log(`    - ${item.hcpc} ${item.itemName}`);
        }
      }
    }
    console.log();
  }

  if (missingEquipment > 0) {
    console.log("--- PATIENTS WITH MISSING EQUIPMENT ---");
    for (const r of results) {
      if (r.firestorePatient.found && (r.firestorePatient.missingEquipment?.length ?? 0) > 0) {
        console.log(`  ${r.firestorePatient.fullName} (ID: ${r.firestorePatient.id})`);
        console.log(`    PAR items: ${r.parPatient.items.length}`);
        console.log(`    Current equipment on record: ${r.firestorePatient.currentEquipmentCount}`);
        console.log(`    Matching: ${r.firestorePatient.matchingEquipment?.join(", ")}`);
        console.log(`    MISSING: ${r.firestorePatient.missingEquipment?.join(", ")}`);
        console.log();
      }
    }
  }

  // Summary per status
  const statusCounts = new Map<string, number>();
  for (const [, parPatient] of byPatient) {
    for (const item of parPatient.items) {
      const status = item.parStatus || "unknown";
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    }
  }
  console.log("--- PAR STATUS BREAKDOWN ---");
  for (const [status, count] of statusCounts) {
    console.log(`  ${status}: ${count}`);
  }

  console.log("\n=== DONE ===");
}

main().catch(console.error);
