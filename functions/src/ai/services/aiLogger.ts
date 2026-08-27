/**
 * AI interaction logging service.
 * Previously an empty scaffold.
 *
 * Extends the current aiAuditLogs write in askAdminAi.ts with reporting-
 * contract metadata (query methods + evidence) so future answers can be
 * audited for sample-vs-actual violations.
 */

import type { FieldValue } from "firebase-admin/firestore";

import type { Evidence } from "../types/reporting";

export interface AiAuditLogPayload {
  actorUid: string;
  actorEmail: string | null;
  prompt: string;
  intent: string;
  model: string;
  responseLength: number;
  collectionsUsed: string[];
  promptPhiFindingCount: number;
  responsePhiFindingCount: number;
  phiAlertIds: string[];
  reportArtifactCreated: boolean;
  /** New: per-collection count method used to build the answer context. */
  countMethods?: Record<string, string>;
  /** New: evidence references backing the answer context. */
  evidenceRefs?: string[];
  /** Number of high-impact recommendations processed by the recommendation gate. */
  recommendationGatedCount?: number;
  /** Number of high-impact recommendations blocked by the recommendation gate. */
  recommendationBlockedCount?: number;
}

export function buildAiAuditLogPayload(
  payload: AiAuditLogPayload,
  serverTimestamp: FieldValue
): Record<string, unknown> {
  return {
    ...payload,
    createdAt: serverTimestamp,
  };
}