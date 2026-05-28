import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import OpenAI from "openai";

const db = getFirestore();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const MODEL = "gpt-4.1-mini";
const MAX_PROMPT_LENGTH = 4000;

type PhiSeverity = "low" | "medium" | "high" | "critical";

type PhiFinding = {
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

function requireAdmin(request: {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
}): { uid: string; email: string | null } {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  if (request.auth.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  return {
    uid: request.auth.uid,
    email:
      typeof request.auth.token.email === "string"
        ? request.auth.token.email
        : null,
  };
}

function getPrompt(data: unknown): string {
  const prompt =
    typeof (data as { prompt?: unknown })?.prompt === "string"
      ? (data as { prompt: string }).prompt.trim()
      : "";

  if (!prompt) {
    throw new HttpsError("invalid-argument", "Prompt is required.");
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `Prompt exceeds ${MAX_PROMPT_LENGTH} characters.`
    );
  }

  return prompt;
}

function redactValue(value: string): string {
  if (!value) return "***REDACTED***";
  if (value.length <= 4) return "***REDACTED***";

  return `${value.slice(0, 2)}***REDACTED***${value.slice(-2)}`;
}

function scanTextForPhi(text: string, fieldPath: string): PhiFinding[] {
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

function redactPhi(text: string): string {
  let clean = text;

  for (const pattern of PHI_PATTERNS) {
    clean = clean.replace(pattern.regex, "***REDACTED_PHI***");
  }

  return clean;
}

function highestSeverity(findings: PhiFinding[]): PhiSeverity {
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

async function createPhiAlert(params: {
  actorUid: string;
  actorEmail: string | null;
  source: "prompt" | "response";
  findings: PhiFinding[];
}): Promise<string | null> {
  if (params.findings.length === 0) return null;

  const alertRef = await db.collection("phiAlerts").add({
    severity: highestSeverity(params.findings),
    source: `jarvis.${params.source}`,
    sourceCollection: "aiAuditLogs",
    detectedTypes: Array.from(
      new Set(params.findings.map((finding) => finding.type))
    ),
    findings: params.findings,
    status: "open",
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    recommendation:
      "Review the Jarvis interaction and confirm whether unsafe PHI exposure occurred.",
  });

  return alertRef.id;
}

function inferIntent(prompt: string): string {
  const lower = prompt.toLowerCase();

  if (lower.includes("phi") || lower.includes("hipaa") || lower.includes("leak")) {
    return "phi-risk";
  }

  if (lower.includes("import") || lower.includes("upload") || lower.includes("stuck")) {
    return "imports";
  }

  if (lower.includes("audit") || lower.includes("security")) {
    return "audit";
  }

  if (lower.includes("order")) {
    return "orders";
  }

  if (lower.includes("rental")) {
    return "rentals";
  }

  if (lower.includes("inventory") || lower.includes("product") || lower.includes("stock")) {
    return "inventory";
  }

  if (lower.includes("hospice")) {
    return "hospice";
  }

  if (lower.includes("insurance")) {
    return "insurance";
  }

  return "general";
}

async function getRecentCollectionDocs(collectionName: string, limit: number) {
  const snapshot = await db
    .collection(collectionName)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get()
    .catch(() => db.collection(collectionName).limit(limit).get());

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

async function buildAiContext(intent: string) {
  const [dashboardSnap, auditLogsSnap, importJobsSnap] = await Promise.all([
    db.collection("analytics").doc("dashboard").get(),
    db.collection("auditLogs").orderBy("createdAt", "desc").limit(25).get(),
    db.collection("importJobs").orderBy("createdAt", "desc").limit(25).get(),
  ]);

  const dashboard = dashboardSnap.data() ?? {};

  const recentAuditLogs = auditLogsSnap.docs.map((doc) => {
    const data = doc.data();

    return {
      id: doc.id,
      action: data.action ?? null,
      actorEmail: data.actorEmail ?? null,
      severity: data.severity ?? null,
      createdAt: data.createdAt ?? null,
    };
  });

  const recentImportJobs = importJobsSnap.docs.map((doc) => {
    const data = doc.data();

    return {
      id: doc.id,
      status: data.status ?? null,
      fileName: data.fileName ?? null,
      createdAt: data.createdAt ?? null,
      error: data.error ?? null,
    };
  });

  const context: Record<string, unknown> = {
    dashboard,
    recentAuditLogs,
    recentImportJobs,
  };

  const collectionsUsed = ["analytics/dashboard", "auditLogs", "importJobs"];

  if (intent === "orders" || intent === "general") {
    context.recentOrders = await getRecentCollectionDocs("orders", 15);
    collectionsUsed.push("orders");
  }

  if (intent === "rentals" || intent === "general") {
    context.recentRentals = await getRecentCollectionDocs("rentals", 15);
    collectionsUsed.push("rentals");
  }

  if (intent === "inventory" || intent === "general") {
    context.recentProducts = await getRecentCollectionDocs("products", 20);
    collectionsUsed.push("products");
  }

  if (intent === "hospice") {
    context.recentHospicePatients = await getRecentCollectionDocs(
      "hospicePatients",
      15
    );
    collectionsUsed.push("hospicePatients");
  }

  if (intent === "insurance") {
    context.recentInsuranceRecords = await getRecentCollectionDocs(
      "insuranceRecords",
      15
    );
    collectionsUsed.push("insuranceRecords");
  }

  if (intent === "phi-risk") {
    context.recentPhiAlerts = await getRecentCollectionDocs("phiAlerts", 15);
    collectionsUsed.push("phiAlerts");
  }

  return {
    context,
    collectionsUsed,
  };
}

async function logJarvisMemory(params: {
  actorUid: string;
  actorEmail: string | null;
  intent: string;
  collectionsUsed: string[];
}) {
  await db.collection("jarvisMemory").add({
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    type: "interaction-pattern",
    intent: params.intent,
    collectionsUsed: params.collectionsUsed,
    confidence: 0.55,
    summary: `Admin asked Jarvis about ${params.intent}.`,
    createdAt: FieldValue.serverTimestamp(),
    lastSeenAt: FieldValue.serverTimestamp(),
  });
}

const JARVIS_SYSTEM_PROMPT = `
You are Jarvis, the administrative intelligence assistant for Advanced Home Medical.

Personality:
- Calm, precise, composed, and professionally dry.
- Helpful without being overly cheerful.
- Speak with quiet confidence and subtle wit.
- Do not use childish slang, hype, fake excitement, or rambling.
- Be direct, analytical, and operationally useful.

Hard rules:
- Use only the provided database context.
- Never invent database records.
- Never expose PHI.
- Redact unsafe PHI.
- If evidence is missing, say what is missing.
- Prioritize compliance, auditability, accuracy, and system health.
- Recommend actions, but do not claim you changed database records.

Focus areas:
- Imports
- Audit activity
- Dashboard metrics
- System health
- PHI leak risk
- Orders
- Rentals
- Inventory
- Hospice
- Insurance
- Operational bottlenecks

Response style:
- Start with the direct answer.
- Then list key evidence.
- Then list recommended next actions.
- Keep it concise unless the question requires depth.
`;

export const askAdminAi = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "1GiB",
    secrets: [OPENAI_API_KEY],
  },
  async (request) => {
    const actor = requireAdmin(request);
    const prompt = getPrompt(request.data);

    const intent = inferIntent(prompt);

    const promptPhiFindings = scanTextForPhi(prompt, "prompt");
    const promptPhiAlertId = await createPhiAlert({
      actorUid: actor.uid,
      actorEmail: actor.email,
      source: "prompt",
      findings: promptPhiFindings,
    });

    const safePrompt = redactPhi(prompt);

    const { context, collectionsUsed } = await buildAiContext(intent);

    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY.value(),
    });

    const response = await openai.responses.create({
      model: MODEL,
      temperature: 0.25,
      input: [
        {
          role: "system",
          content: JARVIS_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify({
            question: safePrompt,
            intent,
            context,
          }),
        },
      ],
    });

    const rawAnswer = response.output_text?.trim() || "No response generated.";

    const responsePhiFindings = scanTextForPhi(rawAnswer, "response");
    const responsePhiAlertId = await createPhiAlert({
      actorUid: actor.uid,
      actorEmail: actor.email,
      source: "response",
      findings: responsePhiFindings,
    });

    const answer =
      responsePhiFindings.length > 0
        ? `${redactPhi(
            rawAnswer
          )}\n\nPHI Sentinel: Potential PHI was detected in the generated response and redacted. An alert was created for review.`
        : rawAnswer;

    const phiAlertIds = [promptPhiAlertId, responsePhiAlertId].filter(
      (id): id is string => Boolean(id)
    );

    await db.collection("aiAuditLogs").add({
      actorUid: actor.uid,
      actorEmail: actor.email,
      prompt: safePrompt,
      intent,
      model: MODEL,
      responseLength: answer.length,
      collectionsUsed,
      promptPhiFindingCount: promptPhiFindings.length,
      responsePhiFindingCount: responsePhiFindings.length,
      phiAlertIds,
      createdAt: FieldValue.serverTimestamp(),
    });

    await logJarvisMemory({
      actorUid: actor.uid,
      actorEmail: actor.email,
      intent,
      collectionsUsed,
    });

    return {
      answer,
      intent,
      collectionsUsed,
      memoryLogged: true,
      phiRisk: {
        promptFindings: promptPhiFindings.length,
        responseFindings: responsePhiFindings.length,
        alertIds: phiAlertIds,
      },
    };
  }
);