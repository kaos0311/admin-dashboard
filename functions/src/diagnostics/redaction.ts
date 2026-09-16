const HIGH_ENTROPY_TOKEN = /\b[A-Za-z0-9_\-]{32,}\b/g;
const JWT = /\beyJ[A-Za-z0-9_\-]+?\.[A-Za-z0-9_\-]+?\.[A-Za-z0-9_\-]+?\b/g;
const AUTH_HEADER = /\b(authorization|x-api-key|api-key|cookie|set-cookie)\s*[:=]\s*([^\s,;]+)/gi;
const SECRET_ASSIGNMENT = /\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*)\s*[:=]\s*([^\s,;]+)/gi;
const JS_SECRET_ASSIGNMENT = /\b([A-Za-z0-9_]*(?:apiKey|token|secret|password|credential|privateKey)[A-Za-z0-9_]*)\s*[:=]\s*["'`]([^"'`]{8,})["'`]/g;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const DOB_LABEL = /\b(?:dob|dateOfBirth|birthDate)\s*[:=]\s*["']?\d{1,2}[/-]\d{1,2}[/-]\d{2,4}["']?/gi;
const REQUEST_BODY = /\b(body|requestBody|rawBody|payload)\s*[:=]\s*(\{.*?\}|\[.*?\]|"[^"]*"|'[^']*')/gis;
const PRIVATE_KEY_BLOCK = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;

export function redactDiagnosticText(value: string): string {
  return value
    .replace(PRIVATE_KEY_BLOCK, "[REDACTED_PRIVATE_KEY]")
    .replace(REQUEST_BODY, "$1=[REDACTED_BODY]")
    .replace(AUTH_HEADER, "$1=[REDACTED_SECRET]")
    .replace(SECRET_ASSIGNMENT, "$1=[REDACTED_SECRET]")
    .replace(JS_SECRET_ASSIGNMENT, "$1=[REDACTED_SECRET]")
    .replace(JWT, "[REDACTED_TOKEN]")
    .replace(EMAIL, "[REDACTED_EMAIL]")
    .replace(DOB_LABEL, "dob=[REDACTED_PHI]")
    .replace(SSN, "[REDACTED_PHI]")
    .replace(PHONE, "[REDACTED_PHI]")
    .replace(HIGH_ENTROPY_TOKEN, "[REDACTED_TOKEN]");
}

export function sanitizeDiagnosticParams(params: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const clean: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(params)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("token") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("credential") ||
      lowerKey.includes("password") ||
      lowerKey.includes("authorization")
    ) {
      clean[key] = "[REDACTED]";
      continue;
    }

    if (typeof value === "string") {
      clean[key] = redactDiagnosticText(value).slice(0, 200);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      clean[key] = value;
    } else {
      clean[key] = "[COMPLEX_VALUE_REDACTED]";
    }
  }

  return clean;
}
