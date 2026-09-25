import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { ProcessorName, RowIssue } from "../types/processorResult";

const db = getFirestore();

export async function writeImportIssues(
  importId: string,
  processor: ProcessorName | "header",
  issues: RowIssue[],
  options: { limit?: number } = {}
): Promise<void> {
  if (issues.length === 0) return;

  const limit = options.limit ?? 500;
  const batch = db.batch();

  issues.slice(0, limit).forEach((issue, index) => {
    const ref = db
      .collection("importJobs")
      .doc(importId)
      .collection("issues")
      .doc(`${processor}-${Date.now()}-${index}`);

    batch.set(ref, {
      ...issue,
      processor,
      blockedRow: issue.severity === "error",
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
}
