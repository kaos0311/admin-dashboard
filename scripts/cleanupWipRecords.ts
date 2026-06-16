import * as fs from "node:fs";
import * as path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type WriteBatch } from "firebase-admin/firestore";

type ServiceAccountFile = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

const APPLY = process.argv.includes("--apply");
const STALE_WIP_DAYS = 548;
const BATCH_LIMIT = 400;

const SYSTEM_ASSIGNEES = new Set([
  "administrator",
  "kayla black",
  "zach doss",
  "frank e field",
  "loraine good",
  "kelly griffey",
  "pamela ladd",
  "oliver steddum",
  "jennifer sullivan",
  "joe wilson",
  "nancy zordel",
  "nancey zordel",
]);

function loadServiceAccount() {
  const filePath = path.resolve(process.cwd(), "serviceAccountKey.json");
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

function initAdmin() {
  if (getApps().length) return;

  const serviceAccount = loadServiceAccount();

  initializeApp({
    credential: cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
    }),
  });
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeCommaKey(value: string): string {
  const [last, rest] = value.split(",").map((part) => part?.trim()).filter(Boolean);

  if (!last || !rest) {
    return normalizeKey(value);
  }

  return normalizeKey(`${rest} ${last}`);
}

function shouldMoveToSystem(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  return SYSTEM_ASSIGNEES.has(normalizeKey(value)) ||
    SYSTEM_ASSIGNEES.has(normalizeCommaKey(value));
}

function readNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[$,% ,]/g, ""));

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function readNested(source: Record<string, unknown>, pathParts: string[]): unknown {
  let current: unknown = source;

  for (const part of pathParts) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function firstValue(source: Record<string, unknown>, paths: string[][]): unknown {
  for (const pathParts of paths) {
    const value = readNested(source, pathParts);

    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
  }

  return undefined;
}

function getWipAgeDays(source: Record<string, unknown>): number {
  return readNumber(
    firstValue(source, [
      ["daysOpen"],
      ["wip", "daysInState"],
      ["raw", "WIPDaysInState"],
    ])
  );
}

function isActionableWip(source: Record<string, unknown>): boolean {
  if (source.isActionableWip === true) {
    return true;
  }

  return Boolean(
    firstValue(source, [
      ["wip", "dateNeeded"],
      ["raw", "WIPStatusName"],
      ["raw", "WIPAssignedTo"],
      ["raw", "WIPDateNeeded"],
      ["raw", "WIPDaysInState"],
    ])
  );
}

async function commitIfNeeded(batch: WriteBatch, pendingWrites: number) {
  if (!APPLY || pendingWrites === 0) {
    return;
  }

  await batch.commit();
}

async function main() {
  initAdmin();

  const db = getFirestore();
  const snapshot = await db.collection("wipRecords").get();

  let staleDeleted = 0;
  let movedToSystem = 0;
  let nonActionableIgnored = 0;
  let inspected = 0;
  let pendingWrites = 0;
  let batch = db.batch();

  for (const docSnap of snapshot.docs) {
    inspected += 1;
    const data = docSnap.data();
    const daysOpen = getWipAgeDays(data);
    const actionable = isActionableWip(data);

    if (daysOpen > STALE_WIP_DAYS) {
      staleDeleted += 1;
      batch.delete(docSnap.ref);
      pendingWrites += 1;
    } else if (!actionable) {
      nonActionableIgnored += 1;
    } else if (
      shouldMoveToSystem(data.assignedTo) ||
      shouldMoveToSystem(firstValue(data, [["wip", "assignedTo"], ["raw", "WIPAssignedTo"]]))
    ) {
      movedToSystem += 1;
      batch.update(docSnap.ref, {
        assignedTo: "System",
        "wip.assignedTo": "System",
        systemAssigneeNormalizedAt: FieldValue.serverTimestamp(),
      });
      pendingWrites += 1;
    }

    if (pendingWrites >= BATCH_LIMIT) {
      await commitIfNeeded(batch, pendingWrites);
      batch = db.batch();
      pendingWrites = 0;
    }
  }

  await commitIfNeeded(batch, pendingWrites);

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        inspected,
        staleDeleted,
        movedToSystem,
        nonActionableIgnored,
        staleCutoffDays: STALE_WIP_DAYS,
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
