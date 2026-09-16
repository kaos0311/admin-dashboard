import {FieldValue, getFirestore} from "firebase-admin/firestore";

import {sanitizeDiagnosticParams} from "./redaction.js";
import type {DiagnosticTool} from "./types.js";

export interface DiagnosticAuditInput {
  actorUid: string;
  tool: DiagnosticTool;
  params: Record<string, unknown>;
  success: boolean;
  resultCount: number;
}

export async function writeDiagnosticAudit(input: DiagnosticAuditInput): Promise<void> {
  await getFirestore().collection("diagnosticAuditLogs").add({
    actorUid: input.actorUid,
    tool: input.tool,
    sanitizedParameters: sanitizeDiagnosticParams(input.params),
    createdAt: FieldValue.serverTimestamp(),
    success: input.success,
    resultCount: input.resultCount,
  });
}
