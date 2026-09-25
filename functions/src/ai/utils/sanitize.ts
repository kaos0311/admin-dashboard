/**
 * Sanitization helpers for AI inputs.
 * Previously an empty scaffold.
 */

import { redactPhi } from "../phiSafety";

/** Truncate a prompt to a maximum character budget. */
export function truncatePrompt(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

/**
 * Redact PHI and normalize whitespace before a prompt is logged or sent to
 * the model provider. Uses the authoritative Sentinel patterns.
 */
export function sanitizePromptForLogging(text: string): string {
  return redactPhi(text).replace(/\s+/g, " ").trim();
}