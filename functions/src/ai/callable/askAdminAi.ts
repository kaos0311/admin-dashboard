import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import OpenAI from "openai";

import {
  createPhiAlert,
  redactPhi,
  scanTextForPhi,
} from "../phiSafety";
import { enforceCallableRateLimit } from "../../security/rateLimit.js";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const MODEL = "gpt-4.1-mini";
const MAX_PROMPT_LENGTH = 4000;
const RECENT_DOC_LIMIT = 20;
const SUMMARY_DOC_LIMIT = 1000;

type NumericSummary = {
  count: number;
  sum: number;
  average: number;
  min: number;
  max: number;
};

type CollectionSummary = {
  collection: string;
  loaded: number;
  statusCounts: Record<string, number>;
  numeric: Record<string, NumericSummary>;
  missingKeyCounts: Record<string, number>;
};

type ReportArtifact = {
  type: "csv";
  fileName: string;
  title: string;
  content: string;
};

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

const SUMMARY_FIELDS: Record<string, string[]> = {
  orders: ["quantity", "total", "amount", "chargeAmount"],
  inventory: ["quantityOnHand", "available", "committed", "onRent", "totalValue", "unitCost"],
  products: ["basePrice", "defaultPurchasePrice", "defaultRentalRate", "reorderLevel"],
  shopCostOfGoodsSold: ["quantity", "revenue", "cost", "grossProfit", "grossProfitPct"],
  shopInventoryLots: ["onHandQty", "onRentQty", "onOrderQty", "availableQty", "committedQty"],
  shopInventorySerials: ["availableQty", "onRentQty"],
  rentals: ["quantity", "monthlyRate", "total"],
  wipRecords: ["daysOpen", "daysInState"],
  patientAuthorizations: ["quantity"],
  insuranceRecords: ["payPercentage"],
};

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

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[$,% ,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function getNestedValue(source: Record<string, unknown>, key: string): unknown {
  if (!key.includes(".")) return source[key];

  return key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, source);
}

function getStatusValue(data: Record<string, unknown>): string {
  const value =
    data.status ||
    data.hospiceStatus ||
    data.patientStatus ||
    data.lifecycleStatus ||
    data.importStatus ||
    data.parseStatus ||
    "unknown";

  return String(value || "unknown").toLowerCase().trim() || "unknown";
}

function updateNumericSummary(
  current: NumericSummary | undefined,
  value: number
): NumericSummary {
  if (!current) {
    return { count: 1, sum: value, average: value, min: value, max: value };
  }

  const count = current.count + 1;
  const sum = current.sum + value;

  return {
    count,
    sum,
    average: sum / count,
    min: Math.min(current.min, value),
    max: Math.max(current.max, value),
  };
}

function summarizeDocs(
  collectionName: string,
  docs: Array<Record<string, unknown>>
): CollectionSummary {
  const statusCounts: Record<string, number> = {};
  const numeric: Record<string, NumericSummary> = {};
  const missingKeyCounts: Record<string, number> = {};

  for (const doc of docs) {
    const status = getStatusValue(doc);
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;

    for (const field of SUMMARY_FIELDS[collectionName] ?? []) {
      const value = safeNumber(getNestedValue(doc, field));
      if (value === null) continue;
      numeric[field] = updateNumericSummary(numeric[field], value);
    }

    for (const field of REQUIRED_FIELDS[collectionName] ?? []) {
      const value = getNestedValue(doc, field);
      if (value === null || value === undefined || value === "") {
        missingKeyCounts[field] = (missingKeyCounts[field] ?? 0) + 1;
      }
    }
  }

  return {
    collection: collectionName,
    loaded: docs.length,
    statusCounts,
    numeric,
    missingKeyCounts,
  };
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

async function buildOperationsOverview() {
  const summaries: CollectionSummary[] = [];
  const samples: Record<string, unknown[]> = {};

  await Promise.all(
    CORE_COLLECTIONS.map(async (collectionName) => {
      const docs = await getCollectionSample(collectionName, SUMMARY_DOC_LIMIT).catch(() => []);
      summaries.push(summarizeDocs(collectionName, docs));
      samples[collectionName] = docs.slice(0, 10).map(redactContextDoc);
    })
  );

  summaries.sort((a, b) => a.collection.localeCompare(b.collection));

  const totalRecordsLoaded = summaries.reduce((sum, item) => sum + item.loaded, 0);
  const dataQualityAlerts = summaries.flatMap((summary) =>
    Object.entries(summary.missingKeyCounts)
      .filter(([, count]) => count > 0)
      .map(([field, count]) => ({
        collection: summary.collection,
        field,
        missing: count,
        loaded: summary.loaded,
      }))
  );

  return {
    generatedAt: new Date().toISOString(),
    totalRecordsLoaded,
    summaries,
    samples,
    dataQualityAlerts: dataQualityAlerts.slice(0, 50),
    reportingCapabilities: [
      "CSV export artifact from current operational summary",
      "Markdown executive summary",
      "Averages, sums, counts, missing-data checks, and status grouping",
      "Simple trend/forecast guidance when date fields exist in context",
      "Patient-care guardrails: administrative support only, no clinical replacement",
    ],
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

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function buildCsvReport(context: Record<string, unknown>, intent: string): ReportArtifact | null {
  const overview = context.operationsOverview as
    | { summaries?: CollectionSummary[]; dataQualityAlerts?: unknown[] }
    | undefined;

  if (!overview?.summaries?.length) return null;

  const rows = [
    ["Collection", "Loaded Rows", "Statuses", "Numeric Summaries", "Missing Field Counts"],
    ...overview.summaries.map((summary) => [
      summary.collection,
      summary.loaded,
      JSON.stringify(summary.statusCounts),
      JSON.stringify(summary.numeric),
      JSON.stringify(summary.missingKeyCounts),
    ]),
  ];

  return {
    type: "csv",
    title: "Jarvis Operations Summary",
    fileName: `jarvis-${intent}-${new Date().toISOString().slice(0, 10)}.csv`,
    content: rows.map((row) => row.map(csvEscape).join(",")).join("\n"),
  };
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
    operationsOverview: await buildOperationsOverview(),
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
    context.recentOrders = await getRecentCollectionDocs("orders", RECENT_DOC_LIMIT);
    collectionsUsed.push("orders");
  }

  if (intent === "rentals" || intent === "general") {
    context.recentRentals = await getRecentCollectionDocs("rentals", RECENT_DOC_LIMIT);
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
- You are an administrative decision-support tool, not a replacement for patient care staff.
- Do not make clinical judgments, diagnosis decisions, or treatment decisions.
- When asked for patient-care decisions, provide operational checks and advise human review.

Focus areas:
- Imports
- Audit activity
- Dashboard metrics
- System health
- PHI leak risk
- Orders
- Rentals
- Inventory
- Discontinued product review and product lifecycle status
- Internet search for Home Medical Equipment and Durable Medical Equipment sales, deals, clearance items, and purchasing opportunities when explicitly prompted
- Retail financial analytics: gross margin, inventory turnover, GMROI, sales per square foot, average transaction value, profit margin, sell-through rate, CAC, conversion rate, foot traffic, in-stock percentage, net sales, returns and allowances, current ratio, quick ratio, and revenue growth
- Growth and item-purchasing recommendations grounded in margin, turnover, stock availability, sell-through, GMROI, and order demand
- Hospice
- Insurance
- API registry and integration governance
- Operational bottlenecks
- Exportable reports
- Counts, sums, averages, missing-data checks, and record keeping
- Basic forecasting from available operational history
- Graph-ready data summaries
- Missing-input guidance for any metric that cannot be calculated yet
- API recommendations for growth, but always include security and key-management cautions

Retail recommendation rules:
- Use the retailFinancialInsights context first when answering retail, growth, graph, or purchasing questions.
- If a metric is marked missing or partial, explain what source data is needed before relying on it.
- Do not recommend buying more of an item from one metric alone; combine margin, turnover, GMROI, sell-through, in-stock status, and known order/patient demand.
- For growth recommendations, separate proven findings from suggested data improvements.

DME/HME web search rules:
- Only search the internet when the user explicitly asks for DME/HME/home medical deals, sales, discounts, clearance, promotions, or market purchasing opportunities.
- Prioritize reputable Home Medical Equipment and Durable Medical Equipment suppliers, manufacturer direct stores, and specialty equipment retailers.
- Look for CPAP/sleep therapy, oxygen, mobility, bath safety, incontinence, wound care, orthotics, lift chairs, hospital beds, wheelchair, walker, and general DME/HME categories when relevant.
- Return each finding with item/category, vendor, sale/deal/clearance evidence, price or discount when visible, URL, date checked, and a caution if eligibility, shipping, prescription, MAP pricing, or stock status needs human verification.
- Do not invent deals or prices. If the page does not clearly show the deal, say it needs verification.

Insurance web search rules:
- Only search the internet when the user explicitly asks for insurance changes, updates, payer requirements, authorization requirements, billing requirements, coverage rules, or related insurance operations.
- Prioritize reliable sources: CMS, Medicare, Medicaid, state Medicaid programs, payer provider bulletins, payer medical policies, payer prior authorization pages, MAC/DME MAC guidance, and official regulator pages.
- For each finding, return source organization, topic, what changed or what requirement applies, effective date if visible, billing or authorization impact, direct URL, date checked, and what staff should verify before changing workflow.
- Do not provide legal or clinical advice. Treat findings as operational guidance requiring human payer-policy verification.
- Do not invent requirements, effective dates, codes, or payer rules. If the source is unclear, say it needs payer verification.

Response style:
- Start with the direct answer.
- Then list key evidence.
- Then list recommended next actions.
- Keep it concise unless the question requires depth.
- If a CSV artifact is available, mention that a downloadable report was generated.
`;

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

    const { context, collectionsUsed } = await buildAiContext(intent);
    const reportArtifact =
      intent === "analysis-reporting" || /export|csv|report|graph|chart|summary/i.test(safePrompt)
        ? buildCsvReport(context, intent)
        : null;

    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY.value(),
    });

    const shouldSearchWeb = isPublicWebSearchIntent(intent);

    const response = await openai.responses.create({
      model: MODEL,
      temperature: 0.25,
      ...(shouldSearchWeb
        ? {
            tools: [
              {
                type: "web_search",
                search_context_size: "low",
                user_location: {
                  type: "approximate",
                  country: "US",
                },
              },
            ],
            tool_choice: "required",
          }
        : {}),
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
            availableArtifact: reportArtifact
              ? {
                  type: reportArtifact.type,
                  fileName: reportArtifact.fileName,
                  title: reportArtifact.title,
                }
              : null,
          }),
        },
      ],
    });

    const rawAnswer = response.output_text?.trim() || "No response generated.";

    const responsePhiFindings = isPublicWebSearchIntent(intent)
      ? filterPublicWebResponsePhiFindings(scanTextForPhi(rawAnswer, "response"))
      : scanTextForPhi(rawAnswer, "response");
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
      reportArtifactCreated: Boolean(reportArtifact),
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
