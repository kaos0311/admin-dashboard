import type { RowIssue } from "../../types/processorResult";
import { writeImportIssues } from "../../issues/writeImportIssues";

export async function writePatientAudit(
  importId: string,
  issues: RowIssue[]
): Promise<void> {
  await writeImportIssues(importId, "patients", issues);
}
