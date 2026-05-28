import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import { IMPORT_SAMPLE_BYTES } from "./orderConstants";
import { normalizeImportJob } from "./orderNormalize";

import type {
  ImportJob,
  ImportReportType,
  SmartDetectionResult,
} from "./orderTypes";

export async function readFileSample(
  file: File
): Promise<string> {
  const blob = file.slice(0, IMPORT_SAMPLE_BYTES);

  return blob.text();
}

export function getReportTypeLabel(
  reportType: string
): string {
  switch (reportType) {
    case "delivery":
      return "Delivery Report";

    case "outstanding":
      return "Outstanding Report";

    case "orders":
      return "Orders Report";

    default:
      return "Unknown Report";
  }
}

export async function detectImportType(
  file: File
): Promise<SmartDetectionResult> {
  const lowerName = file.name.toLowerCase();

  let sample = "";

  try {
    if (
      file.type.includes("csv") ||
      lowerName.endsWith(".csv") ||
      file.type.includes("text")
    ) {
      sample = await readFileSample(file);
    }
  } catch {
    sample = "";
  }

  const haystack = `${lowerName}\n${sample}`.toLowerCase();

  const reasons: string[] = [];

  let deliveryScore = 0;
  let outstandingScore = 0;
  let orderScore = 0;

  if (haystack.includes("delivery")) {
    deliveryScore += 3;

    reasons.push("Matched delivery keyword.");
  }

  if (haystack.includes("dispatch")) {
    deliveryScore += 2;

    reasons.push("Matched dispatch keyword.");
  }

  if (haystack.includes("outstanding")) {
    outstandingScore += 3;

    reasons.push("Matched outstanding keyword.");
  }

  if (haystack.includes("balance")) {
    outstandingScore += 2;

    reasons.push("Matched balance keyword.");
  }

  if (
    haystack.includes("sales order") ||
    haystack.includes("order #")
  ) {
    orderScore += 3;

    reasons.push("Matched sales order keyword.");
  }

  if (
    haystack.includes("patient") &&
    haystack.includes("hcpcs")
  ) {
    orderScore += 2;

    reasons.push("Matched patient and HCPCS columns.");
  }

  const scores: Array<{
    reportType: ImportReportType;
    score: number;
  }> = [
    {
      reportType: "delivery" as ImportReportType,
      score: deliveryScore,
    },
    {
      reportType: "outstanding" as ImportReportType,
      score: outstandingScore,
    },
    {
      reportType: "orders" as ImportReportType,
      score: orderScore,
    },
  ];

  const best = scores.sort((a, b) => b.score - a.score)[0];

  if (!best || best.score <= 0) {
    return {
      reportType: "orders" as ImportReportType,
      confidence: 0,
      reasons:
        reasons.length > 0
          ? reasons
          : ["No strong match found. Defaulted to orders."],
    };
  }

  return {
    reportType: best.reportType,
    confidence: best.score >= 4 ? 2 : 1,
    reasons,
  };
}

/**
 * Backward compatibility alias.
 */
export const detectReportTypeFromFile =
  detectImportType;

export async function findRecentDuplicateImport(
  duplicateKey: string
): Promise<ImportJob | null> {
  const importsRef = collection(db, "importJobs");

  const duplicateQuery = query(
    importsRef,
    where("duplicateKey", "==", duplicateKey),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  const snapshot = await getDocs(duplicateQuery);

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];

  return normalizeImportJob(doc.id, doc.data() as ImportJob);
}
