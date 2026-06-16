import OpenAI from "openai";

import { getApps, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import {
  type CallableRequest,
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";

if (!getApps().length) {
  initializeApp();
}

const openAiApiKey = defineSecret("OPENAI_API_KEY");

type AskAdminAiRequest = {
  prompt?: string;
};

type AskAdminAiResponse = {
  answer: string;
  contextUsed: {
    importJobs: number;
    latestImportIssues: number;
    latestImportChunks: number;
    importQueue: number;
    dataQualityIssues: number;
    tasks: number;
    cmnQueue: number;
    parAlerts: number;
    wipRecords: number;
    equipmentRecalls: number;
    recallMatches: number;
    hospicePatients: number;
    auditLogs: number;
    reports: number;
    orders: number;
    insuranceRecords: number;
  };
};

type SafeDoc = Record<string, unknown>;

type CollectionReadParams = {
  collectionName: string;
  limit: number;
  orderBy?: string;
  direction?: "asc" | "desc";
  whereEquals?: {
    field: string;
    value: string | number | boolean;
  };
};

const MAX_PROMPT_LENGTH = 8000;
const MAX_FIELD_LENGTH = 700;

const ALLOWED_ROLES = new Set(["admin", "staff", "tank"]);

const LIMITS = {
  importJobs: 12,
  latestImportIssues: 75,
  latestImportChunks: 25,
  importQueue: 25,
  dataQualityIssues: 25,
  tasks: 25,
  cmnQueue: 25,
  parAlerts: 25,
  wipRecords: 25,
  equipmentRecalls: 15,
  recallMatches: 20,
  hospicePatients: 15,
  auditLogs: 20,
  reports: 12,
  orders: 20,
  insuranceRecords: 20,
};

function getDb() {
  return getFirestore();
}

function getOpenAiClient() {
  const apiKey = openAiApiKey.value();

  if (!apiKey) {
    throw new HttpsError("failed-precondition", "Missing OPENAI_API_KEY.");
  }

  return new OpenAI({ apiKey });
}

function getRole(request: CallableRequest<AskAdminAiRequest>): string {
  const role = request.auth?.token?.role;
  return typeof role === "string" ? role : "";
}

function assertAccess(request: CallableRequest<AskAdminAiRequest>) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const role = getRole(request);

  if (!ALLOWED_ROLES.has(role)) {
    throw new HttpsError(
      "permission-denied",
      "Admin or staff access required."
    );
  }
}

function toPlainValue(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.slice(0, 30).map(toPlainValue);
  }

  if (value && typeof value === "object") {
    const output: SafeDoc = {};

    for (const [key, nestedValue] of Object.entries(value as SafeDoc)) {
      output[key] = toPlainValue(nestedValue);
    }

    return output;
  }

  if (typeof value === "string") {
    return value.length > MAX_FIELD_LENGTH
      ? `${value.slice(0, MAX_FIELD_LENGTH)}...`
      : value;
  }

  return value;
}

function stripSensitiveFields(data: SafeDoc): SafeDoc {
  const blocked = new Set([
    "ssn",
    "socialSecurityNumber",
    "dob",
    "dateOfBirth",
    "birthDate",
    "phone",
    "email",
    "address",
    "street",
    "streetAddress",
    "insuranceId",
    "policyNumber",
    "memberId",
    "medicareNumber",
    "medicaidNumber",
    "raw",
    "rawData",
    "sampleRows",
    "rawHeaders",
  ]);

  const output: SafeDoc = {};

  for (const [key, value] of Object.entries(data)) {
    if (blocked.has(key)) continue;
    output[key] = toPlainValue(value);
  }

  return output;
}

function countBy(items: SafeDoc[], field: string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = item[field];
    const key =
      typeof value === "string" || typeof value === "number"
        ? String(value)
        : "unknown";

    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function summarizeImportIssues(issues: SafeDoc[]) {
  return {
    total: issues.length,
    byCode: countBy(issues, "code"),
    bySeverity: countBy(issues, "severity"),
    byProcessor: countBy(issues, "processor"),
    byField: countBy(issues, "field"),
    examples: issues.slice(0, 15),
  };
}

async function getCollectionSnapshot(params: CollectionReadParams) {
  const {
    collectionName,
    limit,
    orderBy,
    direction = "desc",
    whereEquals,
  } = params;

  try {
    const firestore = getDb();

    let query: FirebaseFirestore.Query = firestore.collection(collectionName);

    if (whereEquals) {
      query = query.where(whereEquals.field, "==", whereEquals.value);
    }

    if (orderBy) {
      query = query.orderBy(orderBy, direction);
    }

    query = query.limit(limit);

    const snapshot = await query.get();

    return snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...stripSensitiveFields(docSnapshot.data()),
    }));
  } catch (error) {
    console.error(`JARVIS CONTEXT READ ERROR: ${collectionName}`, error);
    return [];
  }
}

async function getLatestImportJobWithDetails() {
  try {
    const firestore = getDb();

    const jobSnapshot = await firestore
      .collection("importJobs")
      .orderBy("updatedAt", "desc")
      .limit(1)
      .get();

    if (jobSnapshot.empty) {
      return {
        job: null,
        issues: [],
        chunks: [],
        issueSummary: summarizeImportIssues([]),
      };
    }

    const latestJobDoc = jobSnapshot.docs[0];

    const [issuesSnapshot, chunksSnapshot] = await Promise.all([
      latestJobDoc.ref
        .collection("issues")
        .orderBy("createdAt", "desc")
        .limit(LIMITS.latestImportIssues)
        .get()
        .catch((error) => {
          console.error("LATEST IMPORT ISSUES READ ERROR:", error);
          return null;
        }),

      latestJobDoc.ref
        .collection("chunks")
        .limit(LIMITS.latestImportChunks)
        .get()
        .catch((error) => {
          console.error("LATEST IMPORT CHUNKS READ ERROR:", error);
          return null;
        }),
    ]);

    const issues =
      issuesSnapshot?.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...stripSensitiveFields(docSnapshot.data()),
      })) ?? [];

    const chunks =
      chunksSnapshot?.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...stripSensitiveFields(docSnapshot.data()),
      })) ?? [];

    return {
      job: {
        id: latestJobDoc.id,
        ...stripSensitiveFields(latestJobDoc.data()),
      },
      issues,
      chunks,
      issueSummary: summarizeImportIssues(issues),
    };
  } catch (error) {
    console.error("LATEST IMPORT JOB DETAIL ERROR:", error);

    return {
      job: null,
      issues: [],
      chunks: [],
      issueSummary: summarizeImportIssues([]),
    };
  }
}

async function getCommandCenterContext() {
  const latestImport = await getLatestImportJobWithDetails();

  const [
    importJobs,
    importQueue,
    dataQualityIssues,
    tasks,
    cmnQueue,
    parAlerts,
    wipRecords,
    equipmentRecalls,
    recallMatches,
    hospicePatients,
    auditLogs,
    reports,
    orders,
    insuranceRecords,
  ] = await Promise.all([
    getCollectionSnapshot({
      collectionName: "importJobs",
      limit: LIMITS.importJobs,
      orderBy: "updatedAt",
    }),

    getCollectionSnapshot({
      collectionName: "importQueue",
      limit: LIMITS.importQueue,
      orderBy: "createdAt",
      direction: "asc",
    }),

    getCollectionSnapshot({
      collectionName: "dataQualityIssues",
      limit: LIMITS.dataQualityIssues,
      orderBy: "createdAt",
    }),

    getCollectionSnapshot({
      collectionName: "tasks",
      limit: LIMITS.tasks,
      orderBy: "updatedAt",
    }),

    getCollectionSnapshot({
      collectionName: "cmnQueue",
      limit: LIMITS.cmnQueue,
      orderBy: "dueDate",
      direction: "asc",
    }),

    getCollectionSnapshot({
      collectionName: "parAlerts",
      limit: LIMITS.parAlerts,
      orderBy: "expiresAt",
      direction: "asc",
    }),

    getCollectionSnapshot({
      collectionName: "wipRecords",
      limit: LIMITS.wipRecords,
      orderBy: "updatedAt",
    }),

    getCollectionSnapshot({
      collectionName: "equipmentRecalls",
      limit: LIMITS.equipmentRecalls,
      orderBy: "publishedAt",
    }),

    getCollectionSnapshot({
      collectionName: "recallMatches",
      limit: LIMITS.recallMatches,
      orderBy: "matchedAt",
    }),

    getCollectionSnapshot({
      collectionName: "hospicePatients",
      limit: LIMITS.hospicePatients,
      orderBy: "updatedAt",
    }),

    getCollectionSnapshot({
      collectionName: "auditLogs",
      limit: LIMITS.auditLogs,
      orderBy: "createdAt",
    }),

    getCollectionSnapshot({
      collectionName: "importedReports",
      limit: LIMITS.reports,
      orderBy: "uploadedAt",
    }),

    getCollectionSnapshot({
      collectionName: "orders",
      limit: LIMITS.orders,
      orderBy: "createdAt",
    }),

    getCollectionSnapshot({
      collectionName: "insuranceRecords",
      limit: LIMITS.insuranceRecords,
      orderBy: "importedAt",
    }),
  ]);
type ContextRecord = Record<string, unknown> & {
  id: string;
};
  const stuckImports = (importJobs as ContextRecord[]).filter((job) => {
    const status = String(job.status ?? "").toLowerCase();
    return ["queued", "processing", "active", "running"].includes(status);
  });

  const failedImports = (importJobs as ContextRecord[]).filter((job) => {
    const status = String(job.status ?? "").toLowerCase();
    return ["failed", "error", "errored"].includes(status);
  });

  const openTasks = (tasks as ContextRecord[]).filter((task) => {
    const status = String(task.status ?? "").toLowerCase();
    return !["done", "complete", "completed", "closed"].includes(status);
  });

  const urgentTasks = (tasks as ContextRecord[]).filter((task) => {
    const priority = String(task.priority ?? "").toLowerCase();
    const escalationLevel = Number(task.escalationLevel ?? 0);
    return priority === "urgent" || priority === "critical" || escalationLevel > 0;
  });

  const openCmns = (cmnQueue as ContextRecord[]).filter((item) => {
    const status = String(item.status ?? "").toLowerCase();
    return !["done", "complete", "completed", "closed"].includes(status);
  });

  const openParAlerts = (parAlerts as ContextRecord[]).filter((item) => {
    const status = String(item.status ?? "").toLowerCase();
    return !["done", "complete", "completed", "closed"].includes(status);
  });

  return {
    generatedAt: new Date().toISOString(),

    operationalSummary: {
      latestImportIssueTotal: latestImport.issues.length,
      latestImportIssueSummary: latestImport.issueSummary,
      stuckImportCount: stuckImports.length,
      failedImportCount: failedImports.length,
      openTaskCount: openTasks.length,
      urgentTaskCount: urgentTasks.length,
      openCmnCount: openCmns.length,
      openParAlertCount: openParAlerts.length,
      activeRecallCount: equipmentRecalls.length,
      recallMatchCount: recallMatches.length,
    },

    latestImport,

    imports: {
      recentJobs: importJobs,
      stuckImports,
      failedImports,
      queue: importQueue,
    },

    quality: {
      dataQualityIssues,
    },

    work: {
      tasks,
      openTasks,
      urgentTasks,
      cmnQueue,
      parAlerts,
      wipRecords,
    },

    clinicalOps: {
      hospicePatients,
      orders,
      insuranceRecords,
    },

    recalls: {
      equipmentRecalls,
      recallMatches,
    },

    audit: {
      auditLogs,
      reports,
    },

    counts: {
      importJobs: importJobs.length,
      latestImportIssues: latestImport.issues.length,
      latestImportChunks: latestImport.chunks.length,
      importQueue: importQueue.length,
      dataQualityIssues: dataQualityIssues.length,
      tasks: tasks.length,
      cmnQueue: cmnQueue.length,
      parAlerts: parAlerts.length,
      wipRecords: wipRecords.length,
      equipmentRecalls: equipmentRecalls.length,
      recallMatches: recallMatches.length,
      hospicePatients: hospicePatients.length,
      auditLogs: auditLogs.length,
      reports: reports.length,
      orders: orders.length,
      insuranceRecords: insuranceRecords.length,
    },
  };
}

function buildSystemPrompt() {
  return [
    "You are Jarvis, the operational AI assistant for the Advanced Home Medical Command Center.",
    "You analyze safe Firestore operational context for imports, import issues, chunks, import queue, compliance, CMN queue, PAR alerts, WIP records, tasks, recalls, recall matches, hospice oversight, orders, insurance records, audit logs, reports, dashboard health, and bottlenecks.",
    "Never invent patient data, counts, names, dates, IDs, or metrics.",
    "Do not expose or request PHI.",
    "If information is missing, say exactly what is missing.",
    "Use the provided database context only.",
    "Prioritize urgent operational risks first.",
    "For import questions, inspect latestImport.issueSummary, latestImport.issues, latestImport.chunks, imports.recentJobs, and imports.queue.",
    "For the latest import, group issues by code, severity, processor, and field when useful.",
    "For work queue questions, inspect tasks, cmnQueue, parAlerts, and wipRecords.",
    "For recall questions, inspect equipmentRecalls and recallMatches.",
    "For hospice questions, inspect hospicePatients, orders, and insuranceRecords.",
    "Be direct, practical, and concise.",
    "Use short headings and bullet points.",
    "End with concrete next actions.",
  ].join(" ");
}

function buildUserPrompt(params: {
  prompt: string;
  context: Awaited<ReturnType<typeof getCommandCenterContext>>;
}) {
  return [
    "SAFE DATABASE CONTEXT:",
    JSON.stringify(params.context, null, 2),
    "",
    "USER QUESTION:",
    params.prompt,
  ].join("\n");
}

async function logAiInteraction(params: {
  uid: string;
  role: string;
  prompt: string;
  answer: string;
  contextCounts: AskAdminAiResponse["contextUsed"];
}) {
  try {
    await getDb().collection("aiLogs").add({
      source: "command-center",
      uid: params.uid,
      role: params.role,
      promptPreview: params.prompt.slice(0, 500),
      answerPreview: params.answer.slice(0, 700),
      contextCounts: params.contextCounts,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("JARVIS AI LOG WRITE ERROR:", error);
  }
}

export const askAdminAi = onCall<AskAdminAiRequest, Promise<AskAdminAiResponse>>(
  {
    cors: true,
    memory: "1GiB",
    timeoutSeconds: 120,
    secrets: [openAiApiKey],
  },
  async (request) => {
    assertAccess(request);

    const prompt = request.data?.prompt?.trim();

    if (!prompt) {
      throw new HttpsError("invalid-argument", "Prompt is required.");
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      throw new HttpsError(
        "invalid-argument",
        `Prompt exceeds ${MAX_PROMPT_LENGTH} characters.`
      );
    }

    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const role = getRole(request);

    try {
      const context = await getCommandCenterContext();

      const contextUsed: AskAdminAiResponse["contextUsed"] = {
        importJobs: context.counts.importJobs,
        latestImportIssues: context.counts.latestImportIssues,
        latestImportChunks: context.counts.latestImportChunks,
        importQueue: context.counts.importQueue,
        dataQualityIssues: context.counts.dataQualityIssues,
        tasks: context.counts.tasks,
        cmnQueue: context.counts.cmnQueue,
        parAlerts: context.counts.parAlerts,
        wipRecords: context.counts.wipRecords,
        equipmentRecalls: context.counts.equipmentRecalls,
        recallMatches: context.counts.recallMatches,
        hospicePatients: context.counts.hospicePatients,
        auditLogs: context.counts.auditLogs,
        reports: context.counts.reports,
        orders: context.counts.orders,
        insuranceRecords: context.counts.insuranceRecords,
      };

      const openai = getOpenAiClient();

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        max_tokens: 1400,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(),
          },
          {
            role: "user",
            content: buildUserPrompt({
              prompt,
              context,
            }),
          },
        ],
      });

      const answer =
        completion.choices[0]?.message?.content?.trim() ||
        "No response generated.";

      await logAiInteraction({
        uid,
        role,
        prompt,
        answer,
        contextCounts: contextUsed,
      });

      return {
        answer,
        contextUsed,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      console.error("ASK ADMIN AI ERROR:", error);

      throw new HttpsError("internal", "AI request failed.");
    }
  }
);

