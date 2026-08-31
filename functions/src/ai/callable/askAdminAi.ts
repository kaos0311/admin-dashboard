import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import {
  createPhiAlert,
  redactPhi,
  scanTextForPhi,
} from "../phiSafety";
import { enforceCallableRateLimit } from "../../security/rateLimit.js";
import { buildJarvisSystemPrompt } from "../prompts/adminSystemPrompt";
import {
  buildAuditContext,
} from "../services/auditContext";
import {
  buildOperationsContext,
  type CollectionFetchResult,
} from "../services/contextBuilder";
import {
  selectValueJoinDefinitions,
  verifyDefaultValueJoins,
} from "../services/joinVerifier";
import { buildJarvisResponsesParams, createOpenAiClient } from "../services/openaiClient";
import {
  buildAiAuditLogPayload,
} from "../services/aiLogger";
import {
  buildReportCsv,
  type CollectionSampleSummary,
} from "../tools/reportInsights";
import {
  applyRecommendationGate,
} from "../tools/recommendationGate";
import {
  buildAnalyticsContextSection,
} from "../prompts/analyticsPrompt";
import {
  evaluateClaimLanguage,
} from "../types/reporting";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const MODEL = "gpt-4.1-mini";
const MAX_PROMPT_LENGTH = 4000;
const RECENT_DOC_LIMIT = 20;
const SUMMARY_DOC_LIMIT = 1000;

const CORE_COLLECTIONS = [
  "patients",
  "patients_index",
  "orders",
  "inventory",
  "products",
  "rentals",
  "hospicePatients",
  "insuranceRecords",
  "insurancePatients",
  "wipRecords",
  "patientDeliveryTickets",
  "patientAuthorizations",
  "importJobs",
  "auditLogs",
  "shopItems",
  "shopCostOfGoodsSold",
  "shopInventoryLots",
  "shopInventorySerials",
] as const;

const REQUIRED_FIELDS: Record<string, string[]> = {
  patients: ["patientName", "dob", "phone", "insurance"],
  patients_index: ["patientName", "dob", "phone", "insuranceName"],
  inventory: ["name", "sku", "hcpc", "barcode", "lotNumber"],
  products: ["name", "sku", "hcpcs", "category"],
  shopItems: ["name", "sku", "category"],
  shopCostOfGoodsSold: ["itemName", "revenue", "cost", "quantity"],
  hospicePatients: ["patientName", "nurseName", "nursePhone", "insuranceName"],
  insuranceRecords: ["insuranceName", "payerName", "status"],
  orders: ["patientName", "status", "productType"],
  wipRecords: ["patientName", "assignedTo", "status"],
};

const INTERNAL_OPERATIONS_PATTERN =
  /\b(internal operations|internal audit|database audit|collection|patients|patients_index|patientAuthorizations|rentals|insuranceRecords|insurancePatients|linkage|join verification|contradiction|record integrity)\b/i;

const REQUESTED_COLLECTION_PATTERN =
  /\bcollections?\s+([A-Za-z][A-Za-z0-9_]*)/gi;

type CoreCollection = typeof CORE_COLLECTIONS[number];

interface UnavailableContextMarker {
  collection: string;
  reason: "unsupported_collection" | "sample_query_failed";
  classification: "UNKNOWN";
  evidenceRef: string;
}

function isCoreCollection(value: string): value is CoreCollection {
  return (CORE_COLLECTIONS as readonly string[]).includes(value);
}

function isInternalOperationsPrompt(prompt: string): boolean {
  return INTERNAL_OPERATIONS_PATTERN.test(prompt);
}

function getRequestedUnsupportedCollections(prompt: string): UnavailableContextMarker[] {
  const markers = new Map<string, UnavailableContextMarker>();

  for (const match of prompt.matchAll(REQUESTED_COLLECTION_PATTERN)) {
    const collection = match[1];
    if (!collection || isCoreCollection(collection)) continue;
    markers.set(collection, {
      collection,
      reason: "unsupported_collection",
      classification: "UNKNOWN",
      evidenceRef: `unavailable-context:${collection}:unsupported_collection`,
    });
  }

  return Array.from(markers.values());
}

function requireAdmin(request: {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
}): { uid: string; email: string | null } {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const role = request.auth.token.role;

  if (role !== "admin" && role !== "tank") {
    throw new HttpsError(
      "permission-denied",
      "Admin or Tank access required."
    );
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

function inferIntent(prompt: string): string {
  const lower = prompt.toLowerCase();

  if (isInternalOperationsPrompt(prompt)) {
    return "internal-operations";
  }

  if (
    /\b(search the web|online|internet)\b/i.test(prompt) &&
    /\b(insurance|medicare|medicaid|payer|coverage|authorization|prior auth|preauth|billing)\b/i.test(prompt)
  ) {
    return "insurance-web-search";
  }

  if (
    (lower.includes("deal") ||
      lower.includes("sale") ||
      lower.includes("sales") ||
      lower.includes("clearance") ||
      lower.includes("discount") ||
      lower.includes("promotion") ||
      lower.includes("promo")) &&
    (lower.includes("dme") ||
      lower.includes("durable medical") ||
      lower.includes("home medical") ||
      lower.includes("hme") ||
      lower.includes("equipment") ||
      lower.includes("product"))
  ) {
    return "dme-deals-web-search";
  }

  if (
    lower.includes("insurance") &&
    (lower.includes("change") ||
      lower.includes("changes") ||
      lower.includes("update") ||
      lower.includes("updates") ||
      lower.includes("requirement") ||
      lower.includes("requirements") ||
      lower.includes("authorization") ||
      lower.includes("prior auth") ||
      lower.includes("preauth") ||
      lower.includes("billing") ||
      lower.includes("coverage") ||
      lower.includes("payer") ||
      lower.includes("medicare") ||
      lower.includes("medicaid"))
  ) {
    return "insurance-web-search";
  }

  if (
    lower.includes("export") ||
    lower.includes("report") ||
    lower.includes("graph") ||
    lower.includes("chart") ||
    lower.includes("forecast") ||
    lower.includes("average") ||
    lower.includes("sum") ||
    lower.includes("margin") ||
    lower.includes("gmroi") ||
    lower.includes("turnover") ||
    lower.includes("sell-through") ||
    lower.includes("growth") ||
    lower.includes("purchase")
  ) {
    return "analysis-reporting";
  }

  if (lower.includes("phi") || lower.includes("hipaa") || lower.includes("leak")) {
    return "phi-risk";
  }

  if (lower.includes("import") || lower.includes("upload") || lower.includes("stuck")) {
    return "imports";
  }

  if (lower.includes("audit") || lower.includes("security")) {
    return "audit";
  }

  if (
    lower.includes("api") ||
    lower.includes("integration") ||
    lower.includes("tool") ||
    lower.includes("growth")
  ) {
    return "api-registry";
  }

  if (lower.includes("order")) {
    return "orders";
  }

  if (lower.includes("rental")) {
    return "rentals";
  }

  if (
    lower.includes("inventory") ||
    lower.includes("product") ||
    lower.includes("stock") ||
    lower.includes("discontinued")
  ) {
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

function isPublicWebSearchIntent(intent: string): boolean {
  return intent === "dme-deals-web-search" || intent === "insurance-web-search";
}

function filterPublicWebResponsePhiFindings(
  findings: ReturnType<typeof scanTextForPhi>
) {
  return findings.filter(
    (finding) =>
      finding.type !== "Phone Number" &&
      finding.type !== "Email Address" &&
      finding.type !== "Insurance Identifier"
  );
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

function redactContextDoc(data: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  const allowed = [
    "id",
    "status",
    "fileName",
    "reportType",
    "detectedReportKind",
    "rowCount",
    "processedRows",
    "writtenRows",
    "failedRows",
    "issueCount",
    "createdAt",
    "updatedAt",
    "category",
    "name",
    "sku",
    "hcpcs",
    "hcpc",
    "quantityOnHand",
    "available",
    "onRent",
    "totalValue",
    "assignedTo",
    "daysOpen",
    "priority",
    "source",
  ];

  for (const key of allowed) {
    if (data[key] !== undefined) redacted[key] = data[key];
  }

  return redacted;
}

function hasPossibleApiSecret(data: Record<string, unknown>): boolean {
  const text = [
    data.sampleCode,
    data.notes,
    data.keyLocation,
  ].join("\n");

  return /(api[_-]?key|secret|token|bearer|sk_live|AIza)[\s:=]+[A-Za-z0-9_\-.]{10,}/i.test(
    text
  );
}

function redactApiRegistryDoc(data: Record<string, unknown>) {
  return {
    id: data.id,
    name: data.name ?? "",
    provider: data.provider ?? "",
    status: data.status ?? "",
    category: data.category ?? "",
    purpose: data.purpose ?? "",
    docsUrl: data.docsUrl ?? "",
    baseUrl: data.baseUrl ?? "",
    keyLocation: data.keyLocation ? "documented" : "missing",
    notes: data.notes ?? "",
    sampleCodePresent: Boolean(data.sampleCode),
    possibleSecretInRegistry: hasPossibleApiSecret(data),
    updatedAt: data.updatedAt ?? null,
  };
}

async function getCollectionSample(collectionName: string, limitValue: number) {
  const snapshot = await db.collection(collectionName).limit(limitValue).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

async function getCollectionDocsWhereEquals(
  collectionName: string,
  field: string,
  value: string | number | boolean,
  limit: number
) {
  const snapshot = await db
    .collection(collectionName)
    .where(field, "==", value)
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

async function getCollectionAggregateCount(collectionName: string): Promise<number | null> {
  try {
    const snapshot = await db.collection(collectionName).count().get();
    return snapshot.data().count;
  } catch {
    return null;
  }
}

async function buildJarvisOperationsContext(options: {
  valueJoinDefinitions: import("../services/joinVerifier").ValueJoinDefinition[];
  prompt: string;
}) {
  const results: CollectionFetchResult[] = [];
  const samples: Record<string, Array<Record<string, unknown>>> = {};
  const unavailableContext = getRequestedUnsupportedCollections(options.prompt);

  await Promise.all(
    CORE_COLLECTIONS.map(async (collectionName) => {
      const [docs, aggregateCount] = await Promise.all([
        getCollectionSample(collectionName, SUMMARY_DOC_LIMIT).catch(() => {
          unavailableContext.push({
            collection: collectionName,
            reason: "sample_query_failed",
            classification: "UNKNOWN",
            evidenceRef: `unavailable-context:${collectionName}:sample_query_failed`,
          });
          return [];
        }),
        getCollectionAggregateCount(collectionName),
      ]);
      results.push({
        collection: collectionName,
        docs,
        limit: SUMMARY_DOC_LIMIT,
        aggregateCount,
      });
      samples[collectionName] = docs.slice(0, 10).map(redactContextDoc);
    })
  );

  const valueJoins = options.valueJoinDefinitions.length > 0
    ? await verifyDefaultValueJoins(db, options.valueJoinDefinitions)
    : [];
  const operationsContext = buildOperationsContext(
    results,
    REQUIRED_FIELDS,
    [],
    valueJoins
  );

  const dataQualityAlerts = operationsContext.summaries.flatMap((summary) =>
    Object.entries(summary.missingKeyCounts)
      .filter(([, count]) => count > 0)
      .map(([field, count]) => ({
        collection: summary.collection,
        field,
        missing: count,
        loaded: summary.count.sampledCount,
      }))
  );

  return {
    generatedAt: new Date().toISOString(),
    totalSampledRecords: operationsContext.totalSampledRecords,
    summaries: operationsContext.summaries,
    contradictions: operationsContext.contradictions,
    joins: operationsContext.joins,
    evidence: operationsContext.evidence,
    samples,
    unavailableContext,
    dataQualityAlerts: dataQualityAlerts.slice(0, 50),
    reportingCapabilities: [
      "CSV export artifact from current operational summary",
      "Markdown executive summary",
      "Averages, sums, counts, missing-data checks, and status grouping",
      "Simple trend/forecast guidance when date fields exist in context",
      "Patient-care guardrails: administrative support only, no clinical replacement",
    ],
  } as {
    generatedAt: string;
    totalSampledRecords: number;
    summaries: import("../types/reporting").CollectionSampleSummary[];
    contradictions: import("../types/reporting").CountContradiction[];
    joins: Array<
      | import("../types/reporting").JoinVerification
      | import("../types/reporting").ValueJoinVerification
    >;
    evidence: import("../types/reporting").Evidence[];
    samples: Record<string, Array<Record<string, unknown>>>;
    unavailableContext: UnavailableContextMarker[];
    dataQualityAlerts: Array<{ collection: string; field: string; missing: number; loaded: number }>;
    reportingCapabilities: string[];
  };
}

async function buildRetailFinancialContext() {
  const analyticsSnap = await db.collection("analytics").doc("reports").get();
  const analytics = analyticsSnap.data() ?? {};
  const retailFinancials =
    typeof analytics.retailFinancials === "object" &&
    analytics.retailFinancials !== null
      ? (analytics.retailFinancials as Record<string, unknown>)
      : {};

  return {
    generatedAtLabel: retailFinancials.generatedAtLabel ?? "",
    dataInputs: retailFinancials.dataInputs ?? {},
    metrics: Array.isArray(retailFinancials.metrics)
      ? retailFinancials.metrics.map((metric) => {
          const item =
            typeof metric === "object" && metric !== null
              ? (metric as Record<string, unknown>)
              : {};

          return {
            key: item.key ?? "",
            label: item.label ?? "",
            formattedValue: item.formattedValue ?? "",
            status: item.status ?? "missing",
            formula: item.formula ?? "",
            insight: item.insight ?? "",
            recommendation: item.recommendation ?? "",
            missingInputs: item.missingInputs ?? [],
          };
        })
      : [],
    purchasingSignals: retailFinancials.purchasingSignals ?? [],
    growthRecommendations: retailFinancials.growthRecommendations ?? [],
    missingInputs: retailFinancials.missingInputs ?? [],
    guardrails: [
      "Use only stored metrics and available source rows.",
      "Never invent foot traffic, store square footage, marketing spend, liquidity, or prior-period sales.",
      "When a measure is missing, recommend the data source needed before making a decision.",
      "Purchasing recommendations should consider in-stock percentage, sell-through, GMROI, turnover, margin, and patient/order demand together.",
    ],
  };
}

async function buildAiContext(intent: string, prompt: string) {
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
      action: typeof data.action === "string" ? data.action : null,
      actorEmail: typeof data.actorEmail === "string" ? data.actorEmail : null,
      severity: typeof data.severity === "string" ? data.severity : null,
      createdAt: data.createdAt ?? null,
    };
  });

  const recentImportJobs = importJobsSnap.docs.map((doc) => {
    const data = doc.data();

    return {
      id: doc.id,
      status: typeof data.status === "string" ? data.status : null,
      fileName: typeof data.fileName === "string" ? data.fileName : null,
      createdAt: data.createdAt ?? null,
      error: typeof data.error === "string" ? data.error : null,
    };
  });

  const auditContext = buildAuditContext({
    entries: recentAuditLogs.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actorEmail: entry.actorEmail,
      severity: entry.severity,
      createdAt: entry.createdAt,
    })),
    limitApplied: 25,
  });

  const operations = await buildJarvisOperationsContext({
    valueJoinDefinitions: selectValueJoinDefinitions(prompt),
    prompt,
  });

  const context: Record<string, unknown> = {
    dashboard,
    recentAuditLogs: auditContext.recentAuditLogs,
    auditSampleNote: auditContext.auditSampleNote,
    recentImportJobs,
    operationsOverview: operations,
    retailFinancialInsights: await buildRetailFinancialContext(),
  };

  const collectionsUsed = [
    "analytics/dashboard",
    "analytics/reports",
    "auditLogs",
    "importJobs",
    ...CORE_COLLECTIONS,
  ];

  if (intent === "orders" || intent === "general") {
    context.recentOrders = (
      await getRecentCollectionDocs("orders", RECENT_DOC_LIMIT)
    ).map(redactContextDoc);
    collectionsUsed.push("orders");
  }

  if (intent === "rentals" || intent === "general") {
    context.recentRentals = (
      await getRecentCollectionDocs("rentals", RECENT_DOC_LIMIT)
    ).map(redactContextDoc);
    collectionsUsed.push("rentals");
  }

  if (intent === "inventory" || intent === "general") {
    context.recentProducts = await getRecentCollectionDocs("products", RECENT_DOC_LIMIT);
    context.discontinuedProducts = await getCollectionDocsWhereEquals(
      "products",
      "status",
      "discontinued",
      50
    );
    context.productStatusGuidance = [
      "Use discontinuedProducts when the admin asks Jarvis to find discontinued products.",
      "Treat product status='discontinued' as the internal source of truth unless external scan results are stored in the database.",
      "If external discontinuation scan results are missing, say that the database has no external-source match yet.",
    ];
    collectionsUsed.push("products");
  }

  if (intent === "hospice") {
    context.recentHospicePatients = (await getRecentCollectionDocs(
      "hospicePatients",
      15
    )).map(redactContextDoc);
    collectionsUsed.push("hospicePatients");
  }

  if (intent === "insurance") {
    context.recentInsuranceRecords = (await getRecentCollectionDocs(
      "insuranceRecords",
      15
    )).map(redactContextDoc);
    collectionsUsed.push("insuranceRecords");
  }

  if (intent === "phi-risk") {
    context.recentPhiAlerts = await getRecentCollectionDocs("phiAlerts", 15);
    collectionsUsed.push("phiAlerts");
  }

  if (intent === "api-registry" || intent === "general" || intent === "audit") {
    const apiDocs = await getRecentCollectionDocs("apiRegistry", 50).catch(
      () => []
    );
    context.apiRegistry = apiDocs.map(redactApiRegistryDoc);
    context.apiRegistryGuidance = [
      "Never recommend storing raw API secrets in Firestore.",
      "Prefer Firebase Functions secrets or environment variables for API keys.",
      "Recommend APIs only as candidates for human approval and security review.",
      "Flag missing docs, unclear key handling, stale records, and possible pasted secrets.",
    ];
    collectionsUsed.push("apiRegistry");
  }

  return {
    context,
    collectionsUsed,
    operationsEvidence: operations.evidence,
    contradictions: operations.contradictions,
    joins: operations.joins,
  } as {
    context: Record<string, unknown>;
    collectionsUsed: string[];
    operationsEvidence: import("../types/reporting").Evidence[];
    contradictions: import("../types/reporting").CountContradiction[];
    joins: Array<
      | import("../types/reporting").JoinVerification
      | import("../types/reporting").ValueJoinVerification
    >;
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

export const askAdminAi = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "1GiB",
    secrets: [OPENAI_API_KEY],
  },
  async (request) => {
    await enforceCallableRateLimit(request, "ai");
    const actor = requireAdmin(request);
    const prompt = getPrompt(request.data);

    const intent = inferIntent(prompt);

    const promptPhiFindings = scanTextForPhi(prompt, "prompt");
    const promptPhiAlertId = await createPhiAlert(db, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      source: "jarvis.prompt",
      sourceCollection: "aiAuditLogs",
      findings: promptPhiFindings,
      recommendation:
        "Review the Jarvis interaction and confirm whether unsafe PHI was entered into the assistant prompt.",
      correctiveMeasures: [
        "Coach users to ask operational questions without patient identifiers.",
        "Redact PHI from stored prompt previews and chat history when needed.",
        "Confirm the related conversation is not visible outside authenticated staff/admin views.",
      ],
    });

    const safePrompt = redactPhi(prompt);

    const {
      context,
      collectionsUsed,
      operationsEvidence,
      contradictions,
      joins,
    } = await buildAiContext(intent, safePrompt);

    const reportArtifact =
      intent === "analysis-reporting" || /export|csv|report|graph|chart|summary/i.test(safePrompt)
        ? buildReportCsv(
            (context.operationsOverview as { summaries?: CollectionSampleSummary[] })?.summaries ?? []
          )
        : null;

    const systemPrompt = buildJarvisSystemPrompt();

    const analyticsSection = buildAnalyticsContextSection({
      summaries:
        (context.operationsOverview as { summaries?: CollectionSampleSummary[] })
          ?.summaries ?? [],
      contradictions,
      joins,
    });

    const openai = createOpenAiClient(OPENAI_API_KEY.value());
    const shouldSearchWeb = isPublicWebSearchIntent(intent);

    const response = await openai.responses.create(
      buildJarvisResponsesParams({
        system: `${systemPrompt}\n\n${analyticsSection}`,
        user: JSON.stringify({
          question: safePrompt,
          intent,
          context,
          webSearchInstructions: shouldSearchWeb
            ? {
                objective:
                  intent === "insurance-web-search"
                    ? "Search the live internet for reliable insurance changes, payer updates, authorization requirements, and billing requirements relevant to Home Medical Equipment and Durable Medical Equipment operations."
                    : "Search the live internet for current Home Medical Equipment and Durable Medical Equipment sales, deals, promotions, and clearance items.",
                preferredSearchAreas: [
                  ...(intent === "insurance-web-search"
                    ? [
                        "CMS and Medicare DME coverage updates",
                        "DME MAC billing and prior authorization guidance",
                        "state Medicaid DME provider bulletins",
                        "commercial payer DME medical policies",
                        "payer prior authorization and documentation requirements",
                        "CPAP, oxygen, mobility, hospital bed, wheelchair, and supplies billing requirements",
                      ]
                    : [
                        "CPAP and sleep therapy supplies",
                        "oxygen concentrators and oxygen accessories",
                        "mobility aids, wheelchairs, walkers, rollators, scooters",
                        "bath safety and transfer equipment",
                        "hospital beds, support surfaces, lift chairs",
                        "wound care, incontinence, braces, orthotics, general DME",
                      ]),
                ],
                suggestedSourcesToCheck:
                  intent === "insurance-web-search"
                    ? [
                        "CMS",
                        "Medicare",
                        "CGS Medicare",
                        "Noridian Medicare",
                        "Palmetto GBA",
                        "state Medicaid provider bulletins",
                        "Anthem provider medical policies",
                        "UnitedHealthcare provider policies",
                        "Aetna clinical policy bulletins",
                        "Humana provider policies",
                      ]
                    : [
                        "Direct Home Medical",
                        "CPAP.com",
                        "The CPAP Shop",
                        "1800Wheelchair",
                        "Rehabmart",
                        "Vitality Medical",
                        "Carewell",
                        "Oxygen Concentrator Store",
                        "Respshop",
                        "Sleep Direct",
                      ],
                requiredOutput:
                  intent === "insurance-web-search"
                    ? "Return a concise table or bullets with source organization, topic, change or requirement, effective date if visible, billing/authorization impact, direct URL, date checked, and human verification steps."
                    : "Return a concise table or bullets with vendor, category/item, deal evidence, price/discount if visible, direct URL, date checked, and human verification steps.",
              }
            : null,
        }),
        tools: shouldSearchWeb
          ? [
              {
                type: "web_search",
                search_context_size: "low",
                user_location: {
                  type: "approximate",
                  country: "US",
                },
              },
            ]
          : undefined,
        tool_choice: shouldSearchWeb ? "required" : undefined,
      })
    );

    const rawAnswer = (response as { output_text?: string }).output_text?.trim() || "No response generated.";

    const gateResult = applyRecommendationGate({
      answer: rawAnswer,
      summaries: (context.operationsOverview as { summaries?: CollectionSampleSummary[] })?.summaries ?? [],
      contradictions,
      joins,
      evidence: operationsEvidence,
    });
    const gatedAnswer = gateResult.gatedAnswer;

    const claimCheck = evaluateClaimLanguage(gatedAnswer, {
      hasAggregateEvidence: operationsEvidence.some((e) => e.kind === "aggregate_count"),
    });

    const responsePhiFindings = isPublicWebSearchIntent(intent)
      ? filterPublicWebResponsePhiFindings(scanTextForPhi(gatedAnswer, "response"))
      : scanTextForPhi(gatedAnswer, "response");
    const responsePhiAlertId = await createPhiAlert(db, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      source: "jarvis.response",
      sourceCollection: "aiAuditLogs",
      findings: responsePhiFindings,
      recommendation:
        "Review the Jarvis response and confirm whether unsafe PHI was generated before the response was redacted.",
      correctiveMeasures: [
        "Keep the redacted response in place.",
        "Inspect the database context that fed the response for unnecessary PHI.",
        "Tighten summary fields if PHI was exposed through operational context.",
      ],
    });

    const answer =
      responsePhiFindings.length > 0
        ? `${redactPhi(
            gatedAnswer
          )}\n\nPHI Sentinel: Potential PHI was detected in the generated response and redacted. An alert was created for review.`
        : claimCheck.allowed
          ? gatedAnswer
          : `${gatedAnswer}\n\n[Jarvis accuracy note: some absolute language was downgraded because the evidence does not support it. ${claimCheck.suggestions.join(" / ")}.]`;

    const phiAlertIds = [promptPhiAlertId, responsePhiAlertId].filter(
      (id): id is string => Boolean(id)
    );

    const countMethods = Object.fromEntries(
      (context.operationsOverview as { summaries?: CollectionSampleSummary[] })
        ?.summaries?.map((s) => [s.collection, s.count.method]) ?? []
    );
    const joinEvidenceRefs = joins
      .map((join) => ("evidenceRef" in join ? join.evidenceRef : null))
      .filter((ref): ref is string => Boolean(ref));

    const auditPayload = buildAiAuditLogPayload(
      {
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
        reportArtifactCreated: Boolean(reportArtifact),
        countMethods,
        evidenceRefs: [
          ...operationsEvidence.map((e) => e.reference),
          ...joinEvidenceRefs,
        ],
        joinEvidenceRefs,
        recommendationGatedCount: gateResult.recommendations.length,
        recommendationBlockedCount: gateResult.recommendations.filter((r) => !r.allowed).length,
      },
      FieldValue.serverTimestamp()
    );

    await db.collection("aiAuditLogs").add(auditPayload);

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
      reportArtifact,
      memoryLogged: true,
      phiRisk: {
        promptFindings: promptPhiFindings.length,
        responseFindings: responsePhiFindings.length,
        alertIds: phiAlertIds,
      },
    };
  }
);
