/**
 * Guidance for audit/security-intent Jarvis answers.
 * Previously an empty scaffold.
 */

export const AUDIT_PROMPT_SECTION = `
Audit & security guidance:
- Audit-log evidence supports INFERRED conclusions only; pair with aggregate counts for VERIFIED.
- Never claim a control is effective without evidence kind "code_inspection" or a passing test reference.
- PHI findings: report alert counts as sampled-scan results; a clean scan means "no findings in the scanned sample", never "database is PHI-safe".
- Recommendation gating applies: do not recommend restores or data repair from audit-log inference alone.`;