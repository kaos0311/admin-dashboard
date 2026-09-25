/**
 * PHI alert service facade.
 * Previously an empty scaffold.
 *
 * IMPORTANT: the authoritative PHI Sentinel implementation lives in
 * ../phiSafety.ts (patterns, redaction, alert creation). This facade only
 * re-exports it so service-layer callers have a stable import path.
 * Redaction patterns and alert generation MUST NOT be weakened here.
 */

export {
  createPhiAlert,
  highestSeverity,
  redactPhi,
  redactValue,
  scanTextForPhi,
  type PhiFinding,
  type PhiSeverity,
} from "../phiSafety";