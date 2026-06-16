import { createHash } from "crypto";

import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import {
  createPhiAlert,
  type PhiFinding,
  scanTextForPhi,
} from "../phiSafety";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

const DEFAULT_SCAN_COLLECTIONS = [
  "patients",
  "patients_index",
  "orders",
  "rentals",
  "inventory",
  "products",
  "hospicePatients",
  "insuranceRecords",
  "insurancePatients",
  "wipRecords",
  "patientDeliveryTickets",
  "patientAuthorizations",
  "importJobs",
  "auditLogs",
  "aiLogs",
  "aiConversations",
  "complianceIssues",
  "tasks",
] as const;

const MAX_COLLECTIONS = 30;
const DEFAULT_LIMIT_PER_COLLECTION = 300;
const MAX_LIMIT_PER_COLLECTION = 1000;
const MAX_TEXT_LENGTH = 8000;

const RISKY_FIELD_PATTERN =
  /(?:note|notes|comment|comments|memo|description|summary|message|preview|search|raw|text|ocr|parsed|snapshot|reason|issue|issues|error|warning|warnings|details|content)/i;

type ScanRequest = {
  collections?: string[];
  limitPerCollection?: number;
  dryRun?: boolean;
};

type FieldScanResult = {
  collectionName: string;
  documentId: string;
  fieldPath: string;
  findings: PhiFinding[];
};

function requireAdmin(request: {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
}): { uid: string; email: string | null } {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  if (request.auth.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  return {
    uid: request.auth.uid,
    email:
      typeof request.auth.token.email === "string"
        ? request.auth.token.email
        : null,
  };
}

function normalizeCollections(input: unknown): string[] {
  const requested = Array.isArray(input)
    ? input.filter((item): item is string => typeof item === "string")
    : [...DEFAULT_SCAN_COLLECTIONS];

  return Array.from(
    new Set(
      requested
        .map((item) => item.trim())
        .filter((item) => /^[A-Za-z0-9_-]+$/.test(item))
    )
  ).slice(0, MAX_COLLECTIONS);
}

function getLimit(input: unknown): number {
  const parsed = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT_PER_COLLECTION;
  return Math.min(Math.floor(parsed), MAX_LIMIT_PER_COLLECTION);
}

function isRiskyFieldPath(path: string): boolean {
  return RISKY_FIELD_PATTERN.test(path);
}

function collectRiskyStrings(
  value: unknown,
  path: string,
  output: Array<{ fieldPath: string; text: string }>
) {
  if (typeof value === "string") {
    const text = value.trim();
    if (text && isRiskyFieldPath(path)) {
      output.push({
        fieldPath: path,
        text: text.slice(0, MAX_TEXT_LENGTH),
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectRiskyStrings(item, `${path}.${index}`, output);
    });
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    collectRiskyStrings(child, childPath, output);
  }
}

function buildAlertId(result: FieldScanResult): string {
  const hash = createHash("sha1")
    .update(
      [
        result.collectionName,
        result.documentId,
        result.fieldPath,
        ...result.findings.map((finding) => finding.type).sort(),
      ].join("|")
    )
    .digest("hex")
    .slice(0, 24);

  return `phi-${result.collectionName}-${hash}`.slice(0, 120);
}

function correctiveMeasuresFor(result: FieldScanResult): string[] {
  return [
    `Review ${result.collectionName}/${result.documentId} field ${result.fieldPath}.`,
    "Move any legitimate patient-specific details into protected patient chart fields or patient-owned documents.",
    "Remove PHI from notes, search text, raw text, AI prompts, audit previews, and summary fields when it is not required there.",
    "Keep only redacted or minimum-necessary text in operational dashboards and logs.",
    "After correction, mark this alert reviewed and re-run the PHI/HIPAA scan.",
  ];
}

async function scanCollection(
  collectionName: string,
  limitPerCollection: number
): Promise<{
  documentsScanned: number;
  fieldsScanned: number;
  results: FieldScanResult[];
}> {
  const snapshot = await db.collection(collectionName).limit(limitPerCollection).get();
  const results: FieldScanResult[] = [];
  let fieldsScanned = 0;

  for (const doc of snapshot.docs) {
    const riskyStrings: Array<{ fieldPath: string; text: string }> = [];
    collectRiskyStrings(doc.data(), "", riskyStrings);
    fieldsScanned += riskyStrings.length;

    for (const item of riskyStrings) {
      const findings = scanTextForPhi(
        item.text,
        `${collectionName}/${doc.id}.${item.fieldPath}`
      );

      if (findings.length === 0) continue;

      results.push({
        collectionName,
        documentId: doc.id,
        fieldPath: item.fieldPath,
        findings,
      });
    }
  }

  return {
    documentsScanned: snapshot.size,
    fieldsScanned,
    results,
  };
}

export const scanDatabasePhiSafety = onCall<ScanRequest>(
  {
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request) => {
    const actor = requireAdmin(request);
    const collections = normalizeCollections(request.data?.collections);
    const limitPerCollection = getLimit(request.data?.limitPerCollection);
    const dryRun = request.data?.dryRun === true;

    let documentsScanned = 0;
    let fieldsScanned = 0;
    const collectionSummaries: Array<{
      collection: string;
      documentsScanned: number;
      fieldsScanned: number;
      findingFields: number;
    }> = [];
    const allResults: FieldScanResult[] = [];

    for (const collectionName of collections) {
      const scan = await scanCollection(collectionName, limitPerCollection).catch(
        (error) => {
          console.error("PHI DATABASE SCAN COLLECTION ERROR:", {
            collectionName,
            error,
          });

          return {
            documentsScanned: 0,
            fieldsScanned: 0,
            results: [] as FieldScanResult[],
          };
        }
      );

      documentsScanned += scan.documentsScanned;
      fieldsScanned += scan.fieldsScanned;
      allResults.push(...scan.results);

      collectionSummaries.push({
        collection: collectionName,
        documentsScanned: scan.documentsScanned,
        fieldsScanned: scan.fieldsScanned,
        findingFields: scan.results.length,
      });
    }

    const alertIds: string[] = [];

    if (!dryRun) {
      for (const result of allResults) {
        const alertId = await createPhiAlert(db, {
          actorUid: actor.uid,
          actorEmail: actor.email,
          source: "database_scan",
          sourceCollection: result.collectionName,
          sourceDocumentId: result.documentId,
          sourceFieldPath: result.fieldPath,
          findings: result.findings,
          recommendation:
            "Potential PHI was found in an operational text field. Review and correct using minimum-necessary HIPAA handling.",
          correctiveMeasures: correctiveMeasuresFor(result),
          alertId: buildAlertId(result),
        });

        if (alertId) alertIds.push(alertId);
      }
    }

    await db.collection("auditLogs").add({
      action: "phi_database_scan",
      actorUid: actor.uid,
      actorEmail: actor.email,
      severity: allResults.length > 0 ? "high" : "low",
      source: "jarvis",
      dryRun,
      collections,
      documentsScanned,
      fieldsScanned,
      findingFields: allResults.length,
      alertCount: alertIds.length,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      ok: true,
      dryRun,
      collections,
      documentsScanned,
      fieldsScanned,
      findingFields: allResults.length,
      alertCount: alertIds.length,
      alertIds,
      collectionSummaries,
      correctiveMeasures:
        allResults.length > 0
          ? [
              "Review open PHI alerts before exporting reports.",
              "Remove PHI from general notes, raw text, search text, summaries, AI chat previews, and audit previews unless it is required for a protected workflow.",
              "Keep exact medical documents in patient-owned Storage/chart records and expose only minimum-necessary metadata on summary pages.",
              "Re-run the scan after corrections to confirm the alert count drops.",
            ]
          : [
              "No risky text fields matched the current PHI patterns in the scanned sample.",
              "Keep running this scan after imports and before audits or broad exports.",
            ],
    };
  }
);
