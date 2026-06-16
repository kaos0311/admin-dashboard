import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  FieldValue,
  getFirestore,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions";

import { resolveReportType } from "../imports/reportRegistry.js";
import { cleanText } from "../imports/utils/normalize.js";

const db = getFirestore();

const MAX_ANALYTICS_ROWS = 5_000_000;
const ROW_SCAN_PAGE_SIZE = 1_000;
const JOB_PROGRESS_EVERY_ROWS = 10_000;
const ANALYTICS_VERSION = "reports-v5-patient-classification";

type ReportType =
  | "patients"
  | "demographics"
  | "items"
  | "purchases"
  | "rentals"
  | "orders"
  | "delivery"
  | "billing"
  | "insurance"
  | "hospice"
  | "wip"
  | "cpap"
  | "generic";

type CountsByType = Record<ReportType, number>;

type SourceBreakdownRow = {
  key: string;
  label: string;
  category: ReportType;
  rows: number;
  files: number;
};

const REPORT_TYPES: ReportType[] = [
  "patients",
  "demographics",
  "items",
  "purchases",
  "rentals",
  "orders",
  "delivery",
  "billing",
  "insurance",
  "hospice",
  "wip",
  "cpap",
  "generic",
];

type RebuildReportsAnalyticsPayload = {
  includeRowScan?: boolean;
};

type CallableRequestLike = {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
  data?: unknown;
};

function requireStaffOrAdmin(request: CallableRequestLike): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const role = request.auth.token.role;

  if (role !== "admin" && role !== "staff" && role !== "tank") {
    throw new HttpsError(
      "permission-denied",
      "Only staff, admins, or Tank users can rebuild report analytics."
    );
  }
}

function getPayload(data: unknown): RebuildReportsAnalyticsPayload {
  if (!data || typeof data !== "object") return {};
  return data as RebuildReportsAnalyticsPayload;
}

function getAuthEmail(request: CallableRequestLike): string {
  const email = request.auth?.token.email;
  return typeof email === "string" ? email : "";
}

function emptyCounts(): CountsByType {
  return REPORT_TYPES.reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {} as CountsByType);
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function reportTypeFromCandidate(value: unknown): ReportType | null {
  const rawValue = cleanText(value);
  const normalizedValue = rawValue.toLowerCase();
  const normalizedKey = normalizedValue
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (
    !normalizedKey ||
    ["auto", "shop", "unknown", "generic", "generic_import"].includes(
      normalizedKey
    )
  ) {
    return null;
  }

  switch (normalizedKey) {
    case "patients_demographics":
    case "patient_demographics":
    case "patients_contact":
    case "patient_contact":
      return "demographics";
    case "patients_physicians":
    case "patient_physicians":
    case "patients_referrals":
    case "patient_referrals":
      return "patients";
    case "item_detail":
    case "lot_numbers":
    case "serial_number_availability":
      return "items";
    case "insurance":
    case "par_report":
      return "insurance";
    case "work_in_progress":
      return "wip";
    case "gl_account_groups":
    case "gl_detail":
    case "cost_of_goods_sold":
      return "billing";
  }

  if (
    normalizedKey.includes("patients_demographics") ||
    normalizedKey.includes("patient_demographics") ||
    normalizedKey.includes("patients_contact") ||
    normalizedKey.includes("patient_contact")
  ) {
    return "demographics";
  }

  if (
    normalizedKey.includes("patient_physicians") ||
    normalizedKey.includes("patient_referrals")
  ) {
    return "patients";
  }

  if (
    normalizedKey.includes("item_detail") ||
    normalizedKey.includes("lot_numbers") ||
    normalizedKey.includes("serial_number_availability")
  ) {
    return "items";
  }

  if (
    normalizedKey.includes("gl_account_groups") ||
    normalizedKey.includes("gl_detail") ||
    normalizedKey.includes("cost_of_goods_sold")
  ) {
    return "billing";
  }

  if (normalizedKey.includes("par_report") || normalizedKey.includes("insurance")) {
    return "insurance";
  }

  if (normalizedKey.includes("work_in_progress")) {
    return "wip";
  }

  const resolved = resolveReportType({
    fileName: rawValue,
  });

  return REPORT_TYPES.includes(resolved as ReportType)
    ? (resolved as ReportType)
    : null;
}

function normalizeReportType(...values: unknown[]): ReportType {
  for (const value of values) {
    const reportType = reportTypeFromCandidate(value);

    if (reportType) {
      return reportType;
    }
  }

  return "generic";
}

function normalizeSourceKind(...values: unknown[]): string {
  for (const value of values) {
    const rawValue = cleanText(value);
    const key = rawValue
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (
      key &&
      !["auto", "shop", "unknown", "generic", "generic_import"].includes(key)
    ) {
      return key;
    }
  }

  return "unknown";
}

function sourceKindLabel(key: string): string {
  switch (key) {
    case "patients_demographics":
    case "patient_demographics":
      return "Patient Demographics";
    case "patients_contact":
    case "patient_contact":
      return "Patient Contact";
    case "patients_physicians":
    case "patient_physicians":
      return "Patient Physicians";
    case "patients_referrals":
    case "patient_referrals":
      return "Patient Referrals";
    case "item_detail":
      return "Item Detail";
    case "lot_numbers":
      return "Lot Numbers";
    case "serial_number_availability":
      return "Serial Number Availability";
    case "cost_of_goods_sold":
      return "Cost of Goods Sold";
    case "gl_account_groups":
      return "GL Account Groups";
    case "gl_detail":
      return "GL Detail";
    case "par_report":
      return "PAR Report";
    case "work_in_progress":
      return "Work In Progress";
    case "insurance":
      return "Insurance";
    case "unknown":
      return "Unknown";
    default:
      return key
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

function updateSourceBreakdown(
  breakdown: Map<string, SourceBreakdownRow>,
  params: {
    key: string;
    category: ReportType;
    rows: number;
  }
): void {
  const current =
    breakdown.get(params.key) ??
    {
      key: params.key,
      label: sourceKindLabel(params.key),
      category: params.category,
      rows: 0,
      files: 0,
    };

  current.rows += params.rows;
  current.files += 1;
  current.category =
    current.category === "generic" ? params.category : current.category;

  breakdown.set(params.key, current);
}

function formatGeneratedAtLabel(date = new Date()): string {
  return date.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

type RetailMetricStatus = "available" | "partial" | "missing";
type RetailMetricUnit = "currency" | "percent" | "ratio" | "count" | "text";

type RetailFinancialMetric = {
  key: string;
  label: string;
  value: number | null;
  formattedValue: string;
  unit: RetailMetricUnit;
  status: RetailMetricStatus;
  formula: string;
  insight: string;
  recommendation: string;
  missingInputs: string[];
};

type RetailFinancialAnalytics = {
  generatedAtLabel: string;
  metrics: RetailFinancialMetric[];
  purchasingSignals: string[];
  growthRecommendations: string[];
  missingInputs: string[];
  dataInputs: {
    cogsRows: number;
    inventoryRows: number;
    productRows: number;
    orderRows: number;
  };
};

type PatientClassificationAnalytics = {
  indexedPatients: number;
  hospicePatients: number;
  nonHospicePatients: number;
  patientSourceRows: number;
  generatedAtLabel: string;
};

async function countCollection(
  collectionName: string
): Promise<number> {
  const snapshot = await db.collection(collectionName).count().get();
  return snapshot.data().count;
}

async function countActiveHospicePatients(): Promise<number> {
  const activeSnapshot = await db
    .collection("hospicePatients")
    .where("active", "==", true)
    .count()
    .get();

  if (activeSnapshot.data().count > 0) {
    return activeSnapshot.data().count;
  }

  return countCollection("hospicePatients");
}

async function buildPatientClassificationAnalytics(params: {
  countsByType: CountsByType;
  generatedAtLabel: string;
}): Promise<PatientClassificationAnalytics> {
  const [patientsIndexCount, patientsCount, hospicePatients] = await Promise.all([
    countCollection("patients_index").catch(() => 0),
    countCollection("patients").catch(() => 0),
    countActiveHospicePatients().catch(() => 0),
  ]);

  const indexedPatients = Math.max(patientsIndexCount, patientsCount);
  const patientSourceRows =
    params.countsByType.demographics + params.countsByType.patients;

  return {
    indexedPatients,
    hospicePatients,
    nonHospicePatients: Math.max(indexedPatients - hospicePatients, 0),
    patientSourceRows,
    generatedAtLabel: params.generatedAtLabel,
  };
}

function readNumber(
  data: Record<string, unknown>,
  fields: string[]
): number | null {
  for (const field of fields) {
    const value = data[field];
    if (value === null || value === undefined || value === "") continue;

    const parsed = Number(String(value).replace(/[$,% ,]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function sumField(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  fields: string[],
  options?: { absolute?: boolean }
): number {
  return docs.reduce((sum, doc) => {
    const value = readNumber(doc.data(), fields);
    if (value === null) return sum;
    return sum + (options?.absolute ? Math.abs(value) : value);
  }, 0);
}

function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Needs data";

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatRatio(value: number | null, suffix = "x"): string {
  if (value === null || !Number.isFinite(value)) return "Needs data";
  return `${value.toFixed(2)}${suffix}`;
}

function formatRetailPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Needs data";
  return `${value.toFixed(1)}%`;
}

function metric(params: RetailFinancialMetric): RetailFinancialMetric {
  return params;
}

function unavailableMetric(params: {
  key: string;
  label: string;
  unit: RetailMetricUnit;
  formula: string;
  missingInputs: string[];
  recommendation: string;
}): RetailFinancialMetric {
  return metric({
    key: params.key,
    label: params.label,
    value: null,
    formattedValue: "Needs data",
    unit: params.unit,
    status: "missing",
    formula: params.formula,
    insight: `${params.label} needs ${params.missingInputs.join(", ")}.`,
    recommendation: params.recommendation,
    missingInputs: params.missingInputs,
  });
}

async function getCollectionDocs(
  collectionName: string,
  limit = 5000
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const snapshot = await db.collection(collectionName).limit(limit).get();
  return snapshot.docs;
}

async function buildRetailFinancialAnalytics(
  generatedAtLabel: string
): Promise<RetailFinancialAnalytics> {
  const [cogsDocs, inventoryDocs, productDocs, orderDocs, settingsSnap] =
    await Promise.all([
      getCollectionDocs("shopCostOfGoodsSold"),
      getCollectionDocs("inventory"),
      getCollectionDocs("products"),
      getCollectionDocs("orders"),
      db.collection("settings").doc("retailAnalytics").get().catch(() => null),
    ]);

  const settings =
    settingsSnap?.exists === true
      ? (settingsSnap.data() as Record<string, unknown>)
      : {};

  const netSales =
    sumField(cogsDocs, ["revenue", "netSales", "sales", "amount"]) ||
    sumField(orderDocs, ["chargeAmount", "total", "amount", "revenue"]);
  const grossSales = sumField(cogsDocs, ["grossSales", "revenue", "sales"]);
  const cogs = sumField(cogsDocs, ["cost", "cogs", "totalCost"], {
    absolute: true,
  });
  const grossProfit =
    sumField(cogsDocs, ["grossProfit"]) ||
    (netSales > 0 && cogs > 0 ? netSales - cogs : 0);
  const unitsSold = sumField(cogsDocs, ["quantity", "qty"], {
    absolute: true,
  });
  const inventoryUnits = sumField(inventoryDocs, [
    "availableQty",
    "quantityOnHand",
    "onHandQty",
    "available",
    "quantity",
  ]);
  const inventoryValue =
    sumField(inventoryDocs, ["totalValue", "inventoryValue", "extendedCost"], {
      absolute: true,
    }) ||
    inventoryDocs.reduce((sum, doc) => {
      const data = doc.data();
      const qty =
        readNumber(data, [
          "availableQty",
          "quantityOnHand",
          "onHandQty",
          "available",
          "quantity",
        ]) ?? 0;
      const unitCost =
        readNumber(data, ["unitCost", "cost", "defaultPurchasePrice"]) ?? 0;
      return sum + Math.abs(qty * unitCost);
    }, 0);

  const productSkus = new Set(
    productDocs
      .map((doc) => String(doc.data().sku || doc.data().itemId || doc.id).trim())
      .filter(Boolean)
  );
  const inventorySkus = new Set<string>();
  const inventorySkusInStock = new Set<string>();

  for (const doc of inventoryDocs) {
    const data = doc.data();
    const sku = String(data.sku || data.itemId || doc.id).trim();
    if (!sku) continue;

    inventorySkus.add(sku);

    const quantity =
      readNumber(data, [
        "availableQty",
        "quantityOnHand",
        "onHandQty",
        "available",
        "quantity",
      ]) ?? 0;

    if (quantity > 0) {
      inventorySkusInStock.add(sku);
    }
  }

  const allSkus = new Set([...productSkus, ...inventorySkus]);
  const totalSkus = allSkus.size;
  const skusInStock = inventorySkusInStock.size;
  const transactionCount = Math.max(orderDocs.length, cogsDocs.length);

  const storeSquareFeet = readNumber(settings, ["storeSquareFeet"]);
  const marketingSpend = readNumber(settings, ["marketingSpend"]);
  const newCustomers = readNumber(settings, ["newCustomers"]);
  const footTraffic = readNumber(settings, ["footTraffic"]);
  const returnsAmount = readNumber(settings, ["returnsAmount"]) ?? 0;
  const allowancesAmount = readNumber(settings, ["allowancesAmount"]) ?? 0;
  const currentAssets = readNumber(settings, ["currentAssets"]);
  const currentLiabilities = readNumber(settings, ["currentLiabilities"]);
  const quickAssets =
    readNumber(settings, ["quickAssets"]) ??
    ((currentAssets ?? 0) > 0 ? (currentAssets ?? 0) - inventoryValue : null);
  const previousPeriodNetSales = readNumber(settings, ["previousPeriodNetSales"]);

  const metrics: RetailFinancialMetric[] = [];

  const grossMargin =
    netSales > 0 ? (grossProfit / netSales) * 100 : null;
  metrics.push(metric({
    key: "grossMargin",
    label: "Gross Margin",
    value: grossMargin,
    formattedValue: formatRetailPercent(grossMargin),
    unit: "percent",
    status: grossMargin === null ? "missing" : "available",
    formula: "(Net sales - COGS) / net sales",
    insight:
      grossMargin === null
        ? "Import Cost of Goods Sold with revenue and cost to read margin."
        : `Gross profit is ${formatMoney(grossProfit)} on ${formatMoney(netSales)} net sales.`,
    recommendation:
      grossMargin === null
        ? "Use Brightree COGS exports to unlock margin checks."
        : grossMargin < 25
          ? "Review low-margin products, pricing tables, and payer mix before reordering heavily."
          : "Prioritize replenishment for products with strong demand and healthy margin.",
    missingInputs: grossMargin === null ? ["COGS revenue", "COGS cost"] : [],
  }));

  const inventoryTurnover =
    cogs > 0 && inventoryValue > 0 ? cogs / inventoryValue : null;
  metrics.push(metric({
    key: "inventoryTurnover",
    label: "Inventory Turnover",
    value: inventoryTurnover,
    formattedValue: formatRatio(inventoryTurnover),
    unit: "ratio",
    status: inventoryTurnover === null ? "missing" : "available",
    formula: "COGS / inventory value",
    insight:
      inventoryTurnover === null
        ? "Inventory turnover needs COGS and inventory value."
        : `Inventory is turning about ${formatRatio(inventoryTurnover)} for this reporting set.`,
    recommendation:
      inventoryTurnover === null
        ? "Add unit cost or total value to inventory records for turnover alerts."
        : inventoryTurnover < 1
          ? "Check for overstocked or slow-moving items before buying more."
          : "Keep fast-moving stock above threshold so deliveries and front counter sales are not delayed.",
    missingInputs:
      inventoryTurnover === null ? ["COGS cost", "inventory value"] : [],
  }));

  const gmroi =
    grossProfit > 0 && inventoryValue > 0 ? grossProfit / inventoryValue : null;
  metrics.push(metric({
    key: "gmroi",
    label: "GMROI",
    value: gmroi,
    formattedValue: formatRatio(gmroi),
    unit: "ratio",
    status: gmroi === null ? "missing" : "available",
    formula: "Gross margin dollars / inventory value",
    insight:
      gmroi === null
        ? "GMROI needs gross profit and inventory investment."
        : `Every inventory dollar is producing about ${formatRatio(gmroi)} in gross margin.`,
    recommendation:
      gmroi === null
        ? "Connect inventory cost/value to let Jarvis rank buying priorities."
        : gmroi < 1
          ? "Investigate slow-moving inventory before adding more of the same item."
          : "Favor items with strong GMROI when planning resupply.",
    missingInputs: gmroi === null ? ["gross profit", "inventory value"] : [],
  }));

  const salesPerSquareFoot =
    netSales > 0 && storeSquareFeet && storeSquareFeet > 0
      ? netSales / storeSquareFeet
      : null;
  metrics.push(salesPerSquareFoot === null
    ? unavailableMetric({
        key: "salesPerSquareFoot",
        label: "Sales per Square Foot",
        unit: "currency",
        formula: "Net sales / retail square feet",
        missingInputs: ["store square feet"],
        recommendation: "Add retail square footage in analytics settings to judge showroom productivity.",
      })
    : metric({
        key: "salesPerSquareFoot",
        label: "Sales per Square Foot",
        value: salesPerSquareFoot,
        formattedValue: formatMoney(salesPerSquareFoot),
        unit: "currency",
        status: "available",
        formula: "Net sales / retail square feet",
        insight: `The retail floor is producing ${formatMoney(salesPerSquareFoot)} per square foot.`,
        recommendation: "Use this to compare display space against high-margin categories.",
        missingInputs: [],
      }));

  const averageTransactionValue =
    netSales > 0 && transactionCount > 0 ? netSales / transactionCount : null;
  metrics.push(metric({
    key: "averageTransactionValue",
    label: "Average Transaction Value",
    value: averageTransactionValue,
    formattedValue: formatMoney(averageTransactionValue),
    unit: "currency",
    status: averageTransactionValue === null ? "missing" : "partial",
    formula: "Net sales / transaction count",
    insight:
      averageTransactionValue === null
        ? "ATV needs sales and transaction records."
        : `Average transaction value is ${formatMoney(averageTransactionValue)} based on available records.`,
    recommendation:
      averageTransactionValue === null
        ? "Connect order transaction counts for cleaner ATV tracking."
        : "Watch for add-on opportunities on related supplies and replacement parts.",
    missingInputs:
      averageTransactionValue === null ? ["net sales", "transaction count"] : [],
  }));

  const profitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : null;
  metrics.push(metric({
    key: "profitMargin",
    label: "Profit Margin",
    value: profitMargin,
    formattedValue: formatRetailPercent(profitMargin),
    unit: "percent",
    status: profitMargin === null ? "missing" : "partial",
    formula: "Known profit / net sales",
    insight:
      profitMargin === null
        ? "Profit margin needs revenue and cost."
        : "This uses gross profit until operating and net expense feeds are added.",
    recommendation:
      profitMargin === null
        ? "Add COGS and GL expense feeds for operating and net margin."
        : "Use with GL expenses later for true operating and net margin.",
    missingInputs:
      profitMargin === null ? ["revenue", "cost"] : ["operating expenses", "net expenses"],
  }));

  const sellThrough =
    unitsSold > 0 || inventoryUnits > 0
      ? (unitsSold / Math.max(unitsSold + inventoryUnits, 1)) * 100
      : null;
  metrics.push(metric({
    key: "sellThroughRate",
    label: "Sell-Through Rate",
    value: sellThrough,
    formattedValue: formatRetailPercent(sellThrough),
    unit: "percent",
    status: sellThrough === null ? "missing" : "partial",
    formula: "Units sold / (units sold + available units)",
    insight:
      sellThrough === null
        ? "Sell-through needs sold quantity and inventory quantity."
        : `Approximate sell-through is ${formatRetailPercent(sellThrough)}.`,
    recommendation:
      sellThrough === null
        ? "Keep quantity in COGS and inventory imports for demand signals."
        : sellThrough > 70
          ? "Review reorder thresholds for high-demand items."
          : "Look for stagnant categories before placing large purchase orders.",
    missingInputs:
      sellThrough === null ? ["sold quantity", "available quantity"] : [],
  }));

  const cac =
    marketingSpend && marketingSpend > 0 && newCustomers && newCustomers > 0
      ? marketingSpend / newCustomers
      : null;
  metrics.push(cac === null
    ? unavailableMetric({
        key: "customerAcquisitionCost",
        label: "Customer Acquisition Cost",
        unit: "currency",
        formula: "Marketing spend / new customers",
        missingInputs: ["marketing spend", "new customer count"],
        recommendation: "Add marketing spend and new customer counts before judging CAC.",
      })
    : metric({
        key: "customerAcquisitionCost",
        label: "Customer Acquisition Cost",
        value: cac,
        formattedValue: formatMoney(cac),
        unit: "currency",
        status: "available",
        formula: "Marketing spend / new customers",
        insight: `CAC is ${formatMoney(cac)} for the configured period.`,
        recommendation: "Compare CAC against customer lifetime value before increasing ad spend.",
        missingInputs: [],
      }));

  const conversionRate =
    transactionCount > 0 && footTraffic && footTraffic > 0
      ? (transactionCount / footTraffic) * 100
      : null;
  metrics.push(conversionRate === null
    ? unavailableMetric({
        key: "conversionRate",
        label: "Conversion Rate",
        unit: "percent",
        formula: "Purchases / foot traffic",
        missingInputs: ["foot traffic"],
        recommendation: "Connect door traffic or counter visit counts to evaluate conversion.",
      })
    : metric({
        key: "conversionRate",
        label: "Conversion Rate",
        value: conversionRate,
        formattedValue: formatRetailPercent(conversionRate),
        unit: "percent",
        status: "available",
        formula: "Purchases / foot traffic",
        insight: `${formatRetailPercent(conversionRate)} of visits produced a purchase.`,
        recommendation: "Use conversion with ATV to coach retail follow-up and merchandising.",
        missingInputs: [],
      }));

  metrics.push(footTraffic === null
    ? unavailableMetric({
        key: "footTraffic",
        label: "Foot Traffic",
        unit: "count",
        formula: "Visitor count by period",
        missingInputs: ["foot traffic"],
        recommendation: "Connect door counter, appointment, or manual traffic counts.",
      })
    : metric({
        key: "footTraffic",
        label: "Foot Traffic",
        value: footTraffic,
        formattedValue: footTraffic.toLocaleString(),
        unit: "count",
        status: "available",
        formula: "Visitor count by period",
        insight: `${footTraffic.toLocaleString()} visits are configured for this period.`,
        recommendation: "Compare traffic against conversion and sales events.",
        missingInputs: [],
      }));

  const inStockPercentage =
    totalSkus > 0 ? (skusInStock / totalSkus) * 100 : null;
  metrics.push(metric({
    key: "inStockPercentage",
    label: "In-Stock Percentage",
    value: inStockPercentage,
    formattedValue: formatRetailPercent(inStockPercentage),
    unit: "percent",
    status: inStockPercentage === null ? "missing" : "available",
    formula: "SKUs with available quantity / total SKUs",
    insight:
      inStockPercentage === null
        ? "In-stock percentage needs product or inventory rows."
        : `${skusInStock.toLocaleString()} of ${totalSkus.toLocaleString()} tracked SKUs show stock available.`,
    recommendation:
      inStockPercentage === null
        ? "Import inventory availability to catch stockout risk."
        : inStockPercentage < 80
          ? "Review reorder thresholds and purchase fast-moving missing items."
          : "Keep monitoring threshold warnings for delivery-critical supplies.",
    missingInputs: inStockPercentage === null ? ["inventory availability"] : [],
  }));

  metrics.push(metric({
    key: "netSales",
    label: "Net Sales",
    value: netSales > 0 ? netSales : null,
    formattedValue: netSales > 0 ? formatMoney(netSales) : "Needs data",
    unit: "currency",
    status: netSales > 0 ? "available" : "missing",
    formula: "Revenue after returns and allowances",
    insight:
      netSales > 0
        ? `Net sales from available reports are ${formatMoney(netSales)}.`
        : "Net sales needs revenue rows.",
    recommendation:
      netSales > 0
        ? "Use net sales beside COGS to guide pricing and purchasing."
        : "Import COGS or GL revenue reports to unlock sales analysis.",
    missingInputs: netSales > 0 ? [] : ["revenue"],
  }));

  const returnsAndAllowances = returnsAmount + allowancesAmount;
  const returnsRate =
    grossSales > 0 && returnsAndAllowances > 0
      ? (returnsAndAllowances / grossSales) * 100
      : null;
  metrics.push(returnsRate === null
    ? unavailableMetric({
        key: "returnsAllowancesRate",
        label: "Returns and Allowances Rate",
        unit: "percent",
        formula: "Returns and allowances / gross sales",
        missingInputs: ["returns amount", "allowances amount"],
        recommendation: "Add return and allowance totals to catch quality, fit, or payer adjustment issues.",
      })
    : metric({
        key: "returnsAllowancesRate",
        label: "Returns and Allowances Rate",
        value: returnsRate,
        formattedValue: formatRetailPercent(returnsRate),
        unit: "percent",
        status: "available",
        formula: "Returns and allowances / gross sales",
        insight: `Returns and allowances are ${formatRetailPercent(returnsRate)} of gross sales.`,
        recommendation: "Review products or processes creating repeat returns.",
        missingInputs: [],
      }));

  const currentRatio =
    currentAssets && currentLiabilities && currentLiabilities > 0
      ? currentAssets / currentLiabilities
      : null;
  metrics.push(currentRatio === null
    ? unavailableMetric({
        key: "currentRatio",
        label: "Current Ratio",
        unit: "ratio",
        formula: "Current assets / current liabilities",
        missingInputs: ["current assets", "current liabilities"],
        recommendation: "Add balance-sheet totals for short-term liquidity review.",
      })
    : metric({
        key: "currentRatio",
        label: "Current Ratio",
        value: currentRatio,
        formattedValue: formatRatio(currentRatio),
        unit: "ratio",
        status: "available",
        formula: "Current assets / current liabilities",
        insight: `Current ratio is ${formatRatio(currentRatio)}.`,
        recommendation: "Use this with cash timing before major purchase commitments.",
        missingInputs: [],
      }));

  const quickRatio =
    quickAssets && currentLiabilities && currentLiabilities > 0
      ? quickAssets / currentLiabilities
      : null;
  metrics.push(quickRatio === null
    ? unavailableMetric({
        key: "quickRatio",
        label: "Quick Ratio",
        unit: "ratio",
        formula: "Quick assets / current liabilities",
        missingInputs: ["quick assets", "current liabilities"],
        recommendation: "Add cash, receivables, and liability totals for quick liquidity checks.",
      })
    : metric({
        key: "quickRatio",
        label: "Quick Ratio",
        value: quickRatio,
        formattedValue: formatRatio(quickRatio),
        unit: "ratio",
        status: "available",
        formula: "Quick assets / current liabilities",
        insight: `Quick ratio is ${formatRatio(quickRatio)}.`,
        recommendation: "Review before committing to large restock orders.",
        missingInputs: [],
      }));

  const revenueGrowth =
    netSales > 0 && previousPeriodNetSales && previousPeriodNetSales > 0
      ? ((netSales - previousPeriodNetSales) / previousPeriodNetSales) * 100
      : null;
  metrics.push(revenueGrowth === null
    ? unavailableMetric({
        key: "revenueGrowth",
        label: "Revenue Growth",
        unit: "percent",
        formula: "(Current sales - previous sales) / previous sales",
        missingInputs: ["previous period net sales"],
        recommendation: "Add prior-period sales or enable period-based sales aggregation for growth trends.",
      })
    : metric({
        key: "revenueGrowth",
        label: "Revenue Growth",
        value: revenueGrowth,
        formattedValue: formatRetailPercent(revenueGrowth),
        unit: "percent",
        status: "available",
        formula: "(Current sales - previous sales) / previous sales",
        insight: `Revenue changed ${formatRetailPercent(revenueGrowth)} from the comparison period.`,
        recommendation:
          revenueGrowth >= 0
            ? "Protect stock levels on categories driving growth."
            : "Review demand, pricing, and payer timing before expanding purchases.",
        missingInputs: [],
      }));

  const missingInputs = Array.from(
    new Set(metrics.flatMap((item) => item.missingInputs))
  );

  const purchasingSignals = [
    inStockPercentage !== null && inStockPercentage < 80
      ? "In-stock percentage is below 80%; check reorder thresholds and delivery-critical items."
      : "",
    sellThrough !== null && sellThrough > 70
      ? "Sell-through is high; review fast-moving supplies before the next delivery cycle."
      : "",
    gmroi !== null && gmroi > 1
      ? "GMROI is positive enough to prioritize high-demand, high-margin items."
      : "",
    inventoryTurnover !== null && inventoryTurnover < 1
      ? "Low turnover suggests caution before adding more slow-moving stock."
      : "",
  ].filter(Boolean);

  const growthRecommendations = [
    grossMargin !== null
      ? "Use gross margin beside payer mix and item category before discounting or reordering."
      : "",
    averageTransactionValue !== null
      ? "Track average transaction value to coach add-on supplies and retail bundles."
      : "",
    conversionRate === null
      ? "Add foot traffic counts so Jarvis can separate sales issues from visitor volume issues."
      : "",
    revenueGrowth === null
      ? "Add prior-period sales to let Jarvis spot growth and seasonal purchasing needs."
      : "",
  ].filter(Boolean);

  return {
    generatedAtLabel,
    metrics,
    purchasingSignals,
    growthRecommendations,
    missingInputs,
    dataInputs: {
      cogsRows: cogsDocs.length,
      inventoryRows: inventoryDocs.length,
      productRows: productDocs.length,
      orderRows: orderDocs.length,
    },
  };
}

async function updateJobProgress(
  jobRef: FirebaseFirestore.DocumentReference,
  data: Record<string, unknown>
): Promise<void> {
  await jobRef.set(
    {
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export const rebuildReportsAnalytics = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (request) => {
    requireStaffOrAdmin(request as CallableRequestLike);

    const payload = getPayload(request.data);
    const includeRowScan = payload.includeRowScan === true;

    const uid = request.auth!.uid;
    const email = getAuthEmail(request as CallableRequestLike);
    const startedAtMs = Date.now();

    const jobRef = await db.collection("systemJobs").add({
      type: "rebuildReportsAnalytics",
      status: "processing",
      stage: "starting",
      includeRowScan,
      requestedBy: uid,
      requestedByEmail: email,
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      const countsByType = emptyCounts();
      const filesByType = emptyCounts();
      const sourceBreakdownMap = new Map<string, SourceBreakdownRow>();
      const uniqueFiles = new Set<string>();

      let totalRows = 0;
      let totalReportDocs = 0;
      let reportsWithZeroRows = 0;
      let scannedRowDocs = 0;

      await updateJobProgress(jobRef, {
        stage: "reading_reports",
      });

      const reportsSnap = await db.collection("importJobs").get();
      totalReportDocs = reportsSnap.size;

      for (const reportDoc of reportsSnap.docs) {
        const data = reportDoc.data();

        uniqueFiles.add(reportDoc.id);

        const reportType = normalizeReportType(
          data.detectedReportKind,
          data.detectedReportType,
          data.sourceReportType,
          data.reportType,
          data.fileName,
          reportDoc.id
        );
        const sourceKind = normalizeSourceKind(
          data.detectedReportKind,
          data.detectedReportType,
          data.sourceReportType,
          data.fileName,
          reportDoc.id
        );

        filesByType[reportType] += 1;

        const rowCount =
          safeNumber(data.totalRows) ||
          safeNumber(data.rowCount) ||
          safeNumber(data.processedRows);

        if (rowCount > 0) {
          totalRows += rowCount;
          countsByType[reportType] += rowCount;
        } else {
          reportsWithZeroRows += 1;
        }

        updateSourceBreakdown(sourceBreakdownMap, {
          key: sourceKind,
          category: reportType,
          rows: rowCount,
        });
      }

      if (includeRowScan) {
        await updateJobProgress(jobRef, {
          stage: "scanning_rows",
          scannedRowDocs: 0,
        });

        const rowCounts = emptyCounts();
        let lastDoc: QueryDocumentSnapshot | undefined;

        while (true) {
          let rowsQuery = db
            .collectionGroup("rows")
            .orderBy("__name__")
            .limit(ROW_SCAN_PAGE_SIZE);

          if (lastDoc) {
            rowsQuery = rowsQuery.startAfter(lastDoc);
          }

          const rowsSnap = await rowsQuery.get();

          if (rowsSnap.empty) break;

          for (const rowDoc of rowsSnap.docs) {
            scannedRowDocs += 1;

            if (scannedRowDocs > MAX_ANALYTICS_ROWS) {
              throw new Error(
                `Row scan exceeded max allowed rows (${MAX_ANALYTICS_ROWS})`
              );
            }

            const data = rowDoc.data();
            const parentReportId = rowDoc.ref.parent.parent?.id;

            if (parentReportId) {
              uniqueFiles.add(parentReportId);
            }

            const reportType = normalizeReportType(
              data.detectedReportKind,
              data.detectedReportType,
              data.sourceReportType,
              data.reportType,
              data.fileName,
              parentReportId
            );

            rowCounts[reportType] += 1;
          }

          lastDoc = rowsSnap.docs.at(-1);

          if (scannedRowDocs % JOB_PROGRESS_EVERY_ROWS === 0) {
            await updateJobProgress(jobRef, {
              stage: "scanning_rows",
              scannedRowDocs,
            });
          }

          if (rowsSnap.size < ROW_SCAN_PAGE_SIZE) break;
        }

        totalRows = scannedRowDocs;

        for (const type of REPORT_TYPES) {
          countsByType[type] = rowCounts[type];
        }
      }

      const durationMs = Date.now() - startedAtMs;
      const generatedAtLabel = formatGeneratedAtLabel();
      const sourceBreakdown = Array.from(sourceBreakdownMap.values()).sort(
        (a, b) => b.rows - a.rows || a.label.localeCompare(b.label)
      );
      const [patientClassification, retailFinancials] = await Promise.all([
        buildPatientClassificationAnalytics({
          countsByType,
          generatedAtLabel,
        }),
        buildRetailFinancialAnalytics(generatedAtLabel),
      ]);

      const analyticsPayload = {
        totalRows,
        totalFiles: uniqueFiles.size,
        totalReportDocs,
        reportsWithZeroRows,
        scannedRowDocs,
        countsByType,
        filesByType,
        sourceBreakdown,
        includeRowScan,
        generatedAtLabel,
        patientClassification,
        retailFinancials,
        rebuiltByUid: uid,
        rebuiltByEmail: email,
        durationMs,
        analyticsVersion: ANALYTICS_VERSION,
        status: "ready",
        source: "Firestore analytics document",
        lastRebuiltByUid: uid,
        lastRebuiltByEmail: email,
        analyticsGeneratedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await db.collection("analytics").doc("reports").set(analyticsPayload, {
        merge: true,
      });

      await updateJobProgress(jobRef, {
        status: "completed",
        stage: "completed",
        totalRows,
        totalFiles: uniqueFiles.size,
        totalReportDocs,
        reportsWithZeroRows,
        scannedRowDocs,
        countsByType,
        filesByType,
        sourceBreakdown,
        patientClassification,
        retailFinancials,
        durationMs,
        completedAt: FieldValue.serverTimestamp(),
      });

      logger.info("Reports analytics rebuilt", {
        analyticsVersion: ANALYTICS_VERSION,
        totalRows,
        totalFiles: uniqueFiles.size,
        totalReportDocs,
        scannedRowDocs,
        countsByType,
        sourceBreakdown,
        patientClassification,
        durationMs,
      });

      return {
        ok: true,
        totalRows,
        totalFiles: uniqueFiles.size,
        totalReportDocs,
        scannedRowDocs,
        analyticsVersion: ANALYTICS_VERSION,
        retailMeasures: retailFinancials.metrics.length,
        durationMs,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed rebuilding analytics";

      logger.error("rebuildReportsAnalytics failed", {
        error: message,
      });

      await updateJobProgress(jobRef, {
        status: "failed",
        stage: "failed",
        error: message,
        failedAt: FieldValue.serverTimestamp(),
      });

      throw new HttpsError("internal", message);
    }
  }
);




