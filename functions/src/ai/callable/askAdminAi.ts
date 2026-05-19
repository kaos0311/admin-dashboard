import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import OpenAI from "openai";

const db = getFirestore();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

function requireAdmin(request: {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
}): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  if (request.auth.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
}

export const askAdminAi = onCall(
  {
    timeoutSeconds: 120,
    memory: "1GiB",
    secrets: [OPENAI_API_KEY],
  },
  async (request) => {
    requireAdmin(request);

    const auth = request.auth!;

    const prompt =
      typeof request.data?.prompt === "string"
        ? request.data.prompt.trim()
        : "";

    if (!prompt) {
      throw new HttpsError("invalid-argument", "Prompt is required.");
    }

    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY.value(),
    });

    const [dashboardSnap, auditLogsSnap, importJobsSnap] = await Promise.all([
      db.collection("analytics").doc("dashboard").get(),

      db.collection("auditLogs")
        .orderBy("createdAt", "desc")
        .limit(25)
        .get(),

      db.collection("importJobs")
        .orderBy("createdAt", "desc")
        .limit(25)
        .get(),
    ]);

    const dashboardData = dashboardSnap.data() ?? {};

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

    const aiContext = {
      dashboard: dashboardData,
      recentAuditLogs,
      recentImportJobs,
    };

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `
You are an AI assistant for a medical equipment analytics dashboard.

Rules:
- Use only the provided context.
- Never invent database records.
- Never expose PHI.
- Focus on operational analytics, imports, audit activity, dashboard metrics, and system health.
          `,
        },
        {
          role: "user",
          content: JSON.stringify({
            question: prompt,
            context: aiContext,
          }),
        },
      ],
    });

    const answer = response.output_text ?? "No response generated.";

    await db.collection("aiAuditLogs").add({
      actorUid: auth.uid,
      actorEmail:
        typeof auth.token.email === "string" ? auth.token.email : null,
      prompt,
      responseLength: answer.length,
      model:"gpt-4o-mini",
      createdAt: FieldValue.serverTimestamp(),
    });

    return { answer };
  }
);