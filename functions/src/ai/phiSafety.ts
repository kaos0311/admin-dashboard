import { FieldValue, type Firestore } from "firebase-admin/firestore";

export type PhiSeverity = "low" | "medium" | "high" | "critical";

export type PhiFinding = {
  type: string;
  severity: PhiSeverity;
  fieldPath: string;
  preview: string;
  recommendation: string;
};

type PhiPattern = {
  type: string;
  severity: PhiSeverity;
  regex: RegExp;
  recommendation: string;
};

const PHI_PATTERNS: PhiPattern[] = [
  {
    type: "SSN",
    severity: "critical",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    recommendation: "Remove or redact Social Security numbers immediately.",
  },
  {
    type: "DOB",
    severity: "high",
    regex:
      /\b(?:DOB|Date of Birth|Birth Date|D\.O\.B\.)\s*[:\-]?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi,
    recommendation: "Remove or redact dates of birth from unsafe text fields.",
  },
  {
    type: "Phone Number",
    severity: "medium",
    regex: /\b(?:\+1\s*)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g,
    recommendation:
      "Verify whether this phone number belongs to a patient before exposing or logging.",
  },
  {
    type: "Email Address",
    severity: "medium",
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    recommendation:
      "Verify whether this email belongs to a patient before exposing or logging.",
  },
  {
    type: "Insurance Identifier",
    severity: "high",
    regex:
      /\b(?:Policy|Member|Insurance|Medicare|Medicaid|Subscriber)\s*(?:ID|#|Number)?\s*[:\-]?\s*[A-Z0-9]{6,24}\b/gi,
    recommendation:
      "Remove or redact insurance identifiers from unsafe fields.",
  },
  {
    type: "Medical Record Identifier",
    severity: "high",
    regex:
      /\b(?:MRN|Medical Record|Patient ID|Patient Number)\s*[:\-#]?\s*[A-Z0-9\-]{4,24}\b/gi,
    recommendation:
      "Remove or redact patient identifiers from unsafe fields.",
  },
];

export function redactValue(value: string): string {
  if (!value) return "***REDACTED***";
  if (value.length <= 4) return "***REDACTED***";

  return `${value.slice(0, 2)}***REDACTED***${value.slice(-2)}`;
}

export function scanTextForPhi(text: string, fieldPath: string): PhiFinding[] {
  const findings: PhiFinding[] = [];

  for (const pattern of PHI_PATTERNS) {
    const matches = text.matchAll(pattern.regex);

    for (const match of matches) {
      const raw = match[0] ?? "";

      findings.push({
        type: pattern.type,
        severity: pattern.severity,
        fieldPath,
        preview: redactValue(raw),
        recommendation: pattern.recommendation,
      });
    }
  }

  return findings;
}

export function redactPhi(text: string): string {
  let clean = text;

  for (const pattern of PHI_PATTERNS) {
    clean = clean.replace(pattern.regex, "***REDACTED_PHI***");
  }

  return clean;
}

export function highestSeverity(findings: PhiFinding[]): PhiSeverity {
  const rank: Record<PhiSeverity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  return findings.reduce<PhiSeverity>((highest, finding) => {
    return rank[finding.severity] > rank[highest]
      ? finding.severity
      : highest;
  }, "low");
}

export async function createPhiAlert(
  db: Firestore,
  params: {
    actorUid: string;
    actorEmail: string | null;
    source: string;
    sourceCollection: string;
    sourceDocumentId?: string | null;
    sourceFieldPath?: string | null;
    findings: PhiFinding[];
    recommendation: string;
    correctiveMeasures?: string[];
    alertId?: string;
  }
): Promise<string | null> {
  if (params.findings.length === 0) return null;

  const alertPayload = {
    severity: highestSeverity(params.findings),
    source: params.source,
    sourceCollection: params.sourceCollection,
    sourceDocumentId: params.sourceDocumentId ?? null,
    sourceFieldPath: params.sourceFieldPath ?? null,
    detectedTypes: Array.from(
      new Set(params.findings.map((finding) => finding.type))
    ),
    findings: params.findings,
    status: "open",
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    reviewedBy: null,
    reviewedAt: null,
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    recommendation: params.recommendation,
    correctiveMeasures: params.correctiveMeasures ?? [],
  };

  if (params.alertId) {
    await db
      .collection("phiAlerts")
      .doc(params.alertId)
      .set(alertPayload, { merge: true });
    return params.alertId;
  }

  const alertRef = await db.collection("phiAlerts").add(alertPayload);
  return alertRef.id;
}
