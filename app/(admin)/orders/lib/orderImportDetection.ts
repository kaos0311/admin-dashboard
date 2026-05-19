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
import type { ImportJob, ImportReportType, SmartDetectionResult } from "./orderTypes";

export async function readFileSample(file: File): Promise<string> {
  const blob = file.slice(0, IMPORT_SAMPLE_BYTES);
  return await blob.text();
}

export async function detectReportTypeFromFile(
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
  let billingScore = 0;

  if (haystack.includes("delivery ticket")) {
    deliveryScore += 4;
    reasons.push("Found delivery ticket language.");
  }

  if (haystack.includes("ticket")) deliveryScore += 1;
  if (haystack.includes("delivery")) deliveryScore += 2;
  if (lowerName.endsWith(".pdf") || file.type.includes("pdf")) deliveryScore += 1;

  if (haystack.includes("outstanding sales")) {
    outstandingScore += 4;
    reasons.push("Found outstanding sales language.");
  }

  if (haystack.includes("sales order")) outstandingScore += 3;
  if (haystack.includes("so number")) outstandingScore += 2;
  if (haystack.includes("customer id")) outstandingScore += 1;

  if (haystack.includes("billing review")) {
    billingScore += 4;
    reasons.push("Found billing review language.");
  }

  if (haystack.includes("payor")) billingScore += 2;
  if (haystack.includes("insurance")) billingScore += 2;
  if (haystack.includes("balance")) billingScore += 1;
  if (haystack.includes("claim")) billingScore += 1;

  const scores: Array<{ type: ImportReportType; score: number }> = [
    { type: "deliveryTickets", score: deliveryScore },
    { type: "outstandingSalesOrders", score: outstandingScore },
    { type: "billingReview", score: billingScore },
    { type: "genericOrders", score: 1 },
  ];

  scores.sort((a, b) => b.score - a.score);

  const winner = scores[0];
  const confidence = Math.min(0.98, Math.max(0.25, winner.score / 8));

  if (!reasons.length) {
    reasons.push("No strong report pattern found. Using generic fallback.");
  }

  return {
    reportType: winner.type,
    confidence,
    reasons,
  };
}

export async function findRecentDuplicateImport(
  duplicateKey: string
): Promise<ImportJob | null> {
  const duplicateQuery = query(
    collection(db, "importJobs"),
    where("duplicateKey", "==", duplicateKey),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  const snapshot = await getDocs(duplicateQuery);
  if (snapshot.empty) return null;

  const first = snapshot.docs[0];

  return normalizeImportJob(
    first.id,
    first.data() as Record<string, unknown>
  );
}

export function getReportTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    deliveryTickets: "Delivery Tickets",
    outstandingSalesOrders: "Outstanding Sales Orders",
    billingReview: "Billing Review",
    genericOrders: "Generic Orders",
  };

  return labels[value] || value || "Unknown";
}