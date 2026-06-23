import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as csvParse } from "papaparse";
import pLimit from "p-limit";

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

type EquipmentEntry = {
  hcpc: string;
  itemName: string;
  serialNumber?: string;
  assignedDate?: string;
};

type ParEquipmentByPatient = {
  patientId: string;
  patientName: string;
  equipment: EquipmentEntry[];
};

const CPAP_HCPCS = new Set(
  CPAP_SUPPLY_RULES.flatMap((rule: { hcpcs: string[] }) => rule.hcpcs.map((h: string) => h.toUpperCase()))
);

const PAR_CSV_PATH = path.resolve("c:/Users/pboyl/Downloads/PAR Report.csv");

const limit = pLimit(10); // max 10 concurrent writes

async function main(): Promise<void> {
  console.log("=== Backfill CPAP Equipment from PAR Report ===\n");

  // 1. Parse PAR CSV and group CPAP equipment by patient ID
  const raw = readFileSync(PAR_CSV_PATH, "utf-8");
  const parsed = csvParse<ParRow>(raw, { header: true, skipEmptyLines: true });
  const rows = parsed.data;

  const cpapRows = rows.filter((r: ParRow) => {
    const code = (r.SalesOrderDtlProcCode || "").toUpperCase().trim();
    return CPAP_HCPCS.has(code);
  });

  // Group by PatientID
  const byPatientId = new Map<string, ParEquipmentByPatient>();
  for (const row of cpapRows) {
    const pid = (row.PatientID || "").trim();
    if (!pid) continue;

    if (!byPatientId.has(pid)) {
      byPatientId.set(pid, {
        patientId: pid,
        patientName: (row.PatientName || "").trim(),
        equipment: [],
      });
    }

    const hcpc = (row.SalesOrderDtlProcCode || "").toUpperCase().trim();
    const itemName = (row.SalesOrderDtlItemName || "").trim();

    // Deduplicate: avoid adding the same HCPC+itemName combo multiple times for same patient
    const existing = byPatientId.get(pid)!.equipment;
    const isDuplicate = existing.some(
      (e) => e.hcpc === hcpc && e.itemName === itemName
    );
    if (!isDuplicate) {
      existing.push({
        hcpc,
        itemName,
      });
    }
  }

  console.log(`Total CPAP patients to process: ${byPatientId.size}\n`);

  // 2. For each patient, check Firestore and write equipment if missing
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const writeTasks: Array<() => Promise<void>> = [];

  for (const [pid, parData] of byPatientId) {
    writeTasks.push(async () => {
      try {
        const docRef = adminDb.collection("patients").doc(pid);
        const doc = await docRef.get();

        if (!doc.exists) {
          console.log(`  SKIP: Patient ${pid} (${parData.patientName}) not found in Firestore`);
          skipped++;
          return;
        }

        const existingData = doc.data()!;
        const existingEquipment: EquipmentEntry[] = existingData.currentEquipment || [];

        // Merge PAR equipment with existing, avoiding duplicates by HCPC+itemName
        const existingKeys = new Set(
          existingEquipment.map((e) => `${e.hcpc}|${e.itemName}`)
        );

        const newEquipment: EquipmentEntry[] = [];
        for (const parItem of parData.equipment) {
          const key = `${parItem.hcpc}|${parItem.itemName}`;
          if (!existingKeys.has(key)) {
            newEquipment.push(parItem);
          }
        }

        if (newEquipment.length === 0 && existingData.cpap?.onRecord === true) {
          // Already has this equipment and cpap flag is set
          skipped++;
          return;
        }

        // Prepare update payload
        const updatePayload: Record<string, unknown> = {
          currentEquipment: [...existingEquipment, ...newEquipment],
        };

        // Set cpap.onRecord flag if any CPAP-related equipment is being added
        const hasCpapEq = (updatePayload.currentEquipment as EquipmentEntry[]).some((e) =>
          CPAP_HCPCS.has(e.hcpc)
        );

        if (hasCpapEq) {
          updatePayload["cpap.onRecord"] = true;
        }

        await docRef.update(updatePayload);
        updated++;

        if (newEquipment.length > 0) {
          console.log(
            `  UPDATED: ${parData.patientName || pid} (${pid}) — added ${newEquipment.length} items (had ${existingEquipment.length})`
          );
        } else {
          console.log(
            `  FLAGGED: ${parData.patientName || pid} (${pid}) — set cpap.onRecord=true (had ${existingEquipment.length} items)`
          );
        }
      } catch (err) {
        console.error(`  ERROR: Patient ${pid}:`, err);
        errors++;
      }
    });
  }

  console.log(`Starting batch update of ${writeTasks.length} patients...\n`);

  await Promise.all(writeTasks.map((task) => limit(task)));

  console.log(`\n=== DONE ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already had data): ${skipped}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
