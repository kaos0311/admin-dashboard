import {
  classifyInventoryIndexItem,
  cleanInventoryIndexValue,
  DEFAULT_INVENTORY_CATEGORIES,
  type InventoryCategoryDefinition,
} from "./inventoryIndex";
import { normalizeSearchText } from "./inventoryNormalize";
import type { InventoryItem } from "./inventoryTypes";

export const INVENTORY_GROUPING_RISK_TYPES = [
  "MISSING_CATEGORY",
  "MISSING_PRODUCT_ID",
  "WEAK_PRODUCT_IDENTITY",
  "UNCATEGORIZED",
  "DUPLICATE_SERIAL",
  "DUPLICATE_ASSET_TAG",
  "DUPLICATE_ASSET_NUMBER",
  "POSSIBLE_DUPLICATE_PRODUCT",
  "INCONSISTENT_MANUFACTURER",
  "INCONSISTENT_MODEL",
  "INCONSISTENT_PRODUCT_NAME",
  "MISSING_SERIAL_FOR_SERIALIZED_ITEM",
  "MULTIPLE_PRODUCT_IDS_FOR_SAME_MODEL",
  "SAME_PRODUCT_ID_DIFFERENT_MODEL",
  "INVALID_QUANTITY_METADATA",
  "UNKNOWN",
] as const;

export const INVENTORY_GROUPING_RISK_SEVERITIES = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
] as const;

export type InventoryGroupingRiskType =
  (typeof INVENTORY_GROUPING_RISK_TYPES)[number];

export type InventoryGroupingRiskSeverity =
  (typeof INVENTORY_GROUPING_RISK_SEVERITIES)[number];

export type InventoryGroupingRiskConfidence = "HIGH" | "MEDIUM" | "LOW";

export type InventoryGroupingRisk = {
  riskId: string;
  type: InventoryGroupingRiskType;
  severity: InventoryGroupingRiskSeverity;
  description: string;
  productId: string;
  inventoryItemIds: string[];
  identifiers: string[];
  currentCategory: string;
  currentProductGroupingKey: string;
  productName: string;
  manufacturer: string;
  modelNumber: string;
  locationName: string;
  isSerialized: boolean;
  recommendedCleanupAction: string;
  confidence: InventoryGroupingRiskConfidence;
  searchText: string;
};

export type InventoryGroupingRiskSummary = {
  totalRisks: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  uncategorized: number;
  duplicateSerials: number;
  weakProductIdentity: number;
  affectedRecords: number;
  affectedProducts: number;
};

export type InventoryCategoryQualitySummary = {
  explicit: number;
  inferred: number;
  fallback: number;
  dynamic: number;
};

export type InventoryGroupingRiskAnalysis = {
  summary: InventoryGroupingRiskSummary;
  categoryQuality: InventoryCategoryQualitySummary;
  risks: InventoryGroupingRisk[];
  affectedRecords: string[];
  affectedProducts: string[];
};

type AnalyzerProductRecord = {
  item: InventoryItem;
  productKey: string;
  categoryName: string;
  categorySource: "explicit" | "inferred" | "fallback";
  categoryIsKnownDefinition: boolean;
  isSerialized: boolean;
};

type RiskInput = Omit<InventoryGroupingRisk, "riskId" | "searchText">;

const RECOMMENDATIONS: Record<InventoryGroupingRiskType, string> = {
  MISSING_CATEGORY: "Assign a canonical category if appropriate.",
  MISSING_PRODUCT_ID: "Link this record to an existing canonical product.",
  WEAK_PRODUCT_IDENTITY: "Add product ID, SKU, manufacturer, or model metadata before relying on grouping.",
  UNCATEGORIZED: "Review product metadata and assign a canonical category if appropriate.",
  DUPLICATE_SERIAL: "Verify whether these records represent the same physical asset.",
  DUPLICATE_ASSET_TAG: "Verify whether these asset-tagged records represent the same physical asset.",
  DUPLICATE_ASSET_NUMBER: "Verify whether these asset-numbered records represent the same physical asset.",
  POSSIBLE_DUPLICATE_PRODUCT: "Review these product records before merging or relinking.",
  INCONSISTENT_MANUFACTURER: "Standardize manufacturer metadata for this product ID.",
  INCONSISTENT_MODEL: "Standardize model metadata for this product ID.",
  INCONSISTENT_PRODUCT_NAME: "Standardize display naming after confirming the canonical product.",
  MISSING_SERIAL_FOR_SERIALIZED_ITEM: "Add the serial, asset tag, or asset number for this serialized inventory record.",
  MULTIPLE_PRODUCT_IDS_FOR_SAME_MODEL: "Review whether these product IDs should point to one canonical product.",
  SAME_PRODUCT_ID_DIFFERENT_MODEL: "Review this product ID because it points to conflicting model metadata.",
  INVALID_QUANTITY_METADATA: "Review quantity, available, committed, and rental counts for this record.",
  UNKNOWN: "Review this record manually.",
};

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function clean(value: string | undefined): string {
  return cleanInventoryIndexValue(value);
}

function normalized(value: string): string {
  return normalizeSearchText(value);
}

function normalizedIdentity(values: string[]): string {
  return values.map(normalized).filter(Boolean).join("|");
}

function activeRecord(item: InventoryItem): boolean {
  return !item.isDeleted && item.status !== "inactive" && item.status !== "discontinued";
}

function expectsSerializedIdentifier(item: InventoryItem): boolean {
  return activeRecord(item) && (
    item.status === "rental_out" ||
    item.onRent > 0 ||
    Boolean(item.patientKey || item.patientId || item.activeAssetArchived || item.patientEquipmentArchived)
  );
}

function fallbackIdentityFieldCount(item: InventoryItem): number {
  return [
    item.manufacturer,
    item.modelNumber,
    item.sku,
    item.hcpc,
  ].filter((value) => clean(value).length > 0).length;
}

function display(value: string | undefined, fallback: string): string {
  return clean(value) || fallback;
}

function firstRecord(records: AnalyzerProductRecord[]): AnalyzerProductRecord {
  return [...records].sort((left, right) => compareText(left.item.id, right.item.id))[0];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean))).sort(compareText);
}

function addToMapList<T>(map: Map<string, T[]>, key: string, value: T): void {
  if (!key) return;
  map.set(key, [...(map.get(key) ?? []), value]);
}

function makeRisk(input: RiskInput): InventoryGroupingRisk {
  const searchText = normalized([
    input.type,
    input.severity,
    input.description,
    input.productId,
    input.inventoryItemIds.join(" "),
    input.identifiers.join(" "),
    input.currentCategory,
    input.currentProductGroupingKey,
    input.productName,
    input.manufacturer,
    input.modelNumber,
    input.locationName,
    input.recommendedCleanupAction,
    input.confidence,
  ].join(" "));

  const riskId = [
    input.type,
    input.description,
    input.currentProductGroupingKey,
    input.identifiers.join("|"),
    input.inventoryItemIds.join("|"),
  ].map(normalized).join(":");

  return {
    ...input,
    riskId,
    searchText,
  };
}

function baseRisk(
  type: InventoryGroupingRiskType,
  severity: InventoryGroupingRiskSeverity,
  records: AnalyzerProductRecord[],
  description: string,
  options: {
    identifiers?: string[];
    confidence?: InventoryGroupingRiskConfidence;
    productId?: string;
    productKey?: string;
  } = {},
): InventoryGroupingRisk {
  const sortedRecords = [...records].sort((left, right) =>
    compareText(left.item.id, right.item.id)
  );
  const first = firstRecord(sortedRecords);
  const item = first.item;

  return makeRisk({
    type,
    severity,
    description,
    productId: options.productId ?? display(item.productId, "-"),
    inventoryItemIds: sortedRecords.map((record) => record.item.id),
    identifiers: unique(options.identifiers ?? []),
    currentCategory: first.categoryName,
    currentProductGroupingKey: options.productKey ?? first.productKey,
    productName: display(item.name, "Unknown Product"),
    manufacturer: display(item.manufacturer, "-"),
    modelNumber: display(item.modelNumber, "-"),
    locationName: display(item.locationName, "Unknown Location"),
    isSerialized: sortedRecords.some((record) => record.isSerialized),
    recommendedCleanupAction: RECOMMENDATIONS[type],
    confidence: options.confidence ?? "HIGH",
  });
}

export function analyzeInventoryGroupingRisks(params: {
  inventoryItems: readonly InventoryItem[];
  categories?: readonly InventoryCategoryDefinition[];
}): InventoryGroupingRiskAnalysis {
  const definitions = [...(params.categories ?? DEFAULT_INVENTORY_CATEGORIES)];
  const risks: InventoryGroupingRisk[] = [];
  const productRecords = new Map<string, AnalyzerProductRecord[]>();
  const productIdRecords = new Map<string, AnalyzerProductRecord[]>();
  const serialRecords = new Map<string, AnalyzerProductRecord[]>();
  const assetTagRecords = new Map<string, AnalyzerProductRecord[]>();
  const assetNumberRecords = new Map<string, AnalyzerProductRecord[]>();
  const manufacturerModelRecords = new Map<string, AnalyzerProductRecord[]>();
  const skuRecords = new Map<string, AnalyzerProductRecord[]>();
  const hcpcManufacturerModelRecords = new Map<string, AnalyzerProductRecord[]>();
  const categoryQuality: InventoryCategoryQualitySummary = {
    explicit: 0,
    inferred: 0,
    fallback: 0,
    dynamic: 0,
  };

  for (const item of params.inventoryItems) {
    const identity = classifyInventoryIndexItem(item, definitions);
    const record: AnalyzerProductRecord = {
      item,
      productKey: identity.productKey,
      categoryName: identity.category.name,
      categorySource: identity.categorySource,
      categoryIsKnownDefinition: identity.categoryIsKnownDefinition,
      isSerialized: identity.isSerialized,
    };

    categoryQuality[identity.categorySource] += 1;
    if (!identity.categoryIsKnownDefinition) categoryQuality.dynamic += 1;

    addToMapList(productRecords, identity.productKey, record);
    addToMapList(productIdRecords, normalized(item.productId), record);
    addToMapList(serialRecords, normalized(item.serial), record);
    addToMapList(assetTagRecords, normalized(item.assetTag ?? ""), record);
    addToMapList(assetNumberRecords, normalized(item.assetNumber ?? ""), record);
    addToMapList(
      manufacturerModelRecords,
      normalizedIdentity([item.manufacturer, item.modelNumber]),
      record,
    );
    addToMapList(skuRecords, normalized(item.sku), record);
    addToMapList(
      hcpcManufacturerModelRecords,
      normalizedIdentity([item.hcpc, item.manufacturer, item.modelNumber]),
      record,
    );

    if (!clean(item.category)) {
      risks.push(baseRisk(
        "MISSING_CATEGORY",
        "MEDIUM",
        [record],
        `Inventory record ${item.id} has no explicit category and was categorized by ${identity.categorySource}.`,
      ));
    }

    if (identity.category.id === "uncategorized") {
      risks.push(baseRisk(
        "UNCATEGORIZED",
        "MEDIUM",
        [record],
        `Inventory record ${item.id} falls into Uncategorized.`,
      ));
    }

    if (!clean(item.productId)) {
      risks.push(baseRisk(
        "MISSING_PRODUCT_ID",
        "MEDIUM",
        [record],
        `Inventory record ${item.id} has no productId.`,
      ));

      if (fallbackIdentityFieldCount(item) < 2) {
        risks.push(baseRisk(
          "WEAK_PRODUCT_IDENTITY",
          "MEDIUM",
          [record],
          `Inventory record ${item.id} relies on weak legacy product grouping metadata.`,
          { confidence: "MEDIUM" },
        ));
      }
    }

    if (!identity.isSerialized && expectsSerializedIdentifier(item)) {
      risks.push(baseRisk(
        "MISSING_SERIAL_FOR_SERIALIZED_ITEM",
        "HIGH",
        [record],
        `Inventory record ${item.id} appears serialized but has no serial, asset tag, or asset number.`,
      ));
    }

    if (
      item.quantityOnHand < 0 ||
      item.available < 0 ||
      item.committed < 0 ||
      item.onRent < 0 ||
      item.available > item.quantityOnHand
    ) {
      risks.push(baseRisk(
        "INVALID_QUANTITY_METADATA",
        "MEDIUM",
        [record],
        `Inventory record ${item.id} has inconsistent quantity metadata.`,
      ));
    }
  }

  addDuplicateIdentifierRisks(risks, serialRecords, "DUPLICATE_SERIAL", "serial");
  addDuplicateIdentifierRisks(risks, assetTagRecords, "DUPLICATE_ASSET_TAG", "asset tag");
  addDuplicateIdentifierRisks(risks, assetNumberRecords, "DUPLICATE_ASSET_NUMBER", "asset number");

  for (const [productId, records] of productIdRecords.entries()) {
    const manufacturers = unique(records.map((record) => record.item.manufacturer));
    const models = unique(records.map((record) => record.item.modelNumber));
    const names = unique(records.map((record) => record.item.name));

    if (manufacturers.length > 1) {
      risks.push(baseRisk(
        "INCONSISTENT_MANUFACTURER",
        "HIGH",
        records,
        `Product ID ${productId} has multiple manufacturer values: ${manufacturers.join(", ")}.`,
        { identifiers: manufacturers, productId },
      ));
    }

    if (models.length > 1) {
      risks.push(baseRisk(
        "SAME_PRODUCT_ID_DIFFERENT_MODEL",
        "HIGH",
        records,
        `Product ID ${productId} has multiple model values: ${models.join(", ")}.`,
        { identifiers: models, productId },
      ));
      risks.push(baseRisk(
        "INCONSISTENT_MODEL",
        "HIGH",
        records,
        `Product ID ${productId} has inconsistent model metadata.`,
        { identifiers: models, productId },
      ));
    }

    if (names.length > 1) {
      risks.push(baseRisk(
        "INCONSISTENT_PRODUCT_NAME",
        "MEDIUM",
        records,
        `Product ID ${productId} has multiple product names: ${names.join(", ")}.`,
        { identifiers: names, productId, confidence: "MEDIUM" },
      ));
    }
  }

  addPossibleDuplicateProductRisks(risks, manufacturerModelRecords, "manufacturer/model", "HIGH");
  addPossibleDuplicateProductRisks(risks, skuRecords, "SKU", "HIGH");
  addPossibleDuplicateProductRisks(risks, hcpcManufacturerModelRecords, "HCPCS/manufacturer/model", "HIGH");

  for (const [key, records] of manufacturerModelRecords.entries()) {
    const productIds = unique(records.map((record) => record.item.productId));
    if (key && productIds.length > 1) {
      risks.push(baseRisk(
        "MULTIPLE_PRODUCT_IDS_FOR_SAME_MODEL",
        "HIGH",
        records,
        `Manufacturer/model combination appears across multiple product IDs: ${productIds.join(", ")}.`,
        { identifiers: productIds, confidence: "HIGH" },
      ));
    }
  }

  const sortedRisks = risks.sort((left, right) =>
    severityRank(left.severity) - severityRank(right.severity) ||
    compareText(left.type, right.type) ||
    compareText(left.riskId, right.riskId)
  );
  const affectedRecords = unique(sortedRisks.flatMap((risk) => risk.inventoryItemIds));
  const affectedProducts = unique(sortedRisks.map((risk) => risk.productId).filter((productId) => productId !== "-"));

  return {
    summary: {
      totalRisks: sortedRisks.length,
      critical: sortedRisks.filter((risk) => risk.severity === "CRITICAL").length,
      high: sortedRisks.filter((risk) => risk.severity === "HIGH").length,
      medium: sortedRisks.filter((risk) => risk.severity === "MEDIUM").length,
      low: sortedRisks.filter((risk) => risk.severity === "LOW").length,
      uncategorized: sortedRisks.filter((risk) => risk.type === "UNCATEGORIZED").length,
      duplicateSerials: sortedRisks.filter((risk) => risk.type === "DUPLICATE_SERIAL").length,
      weakProductIdentity: sortedRisks.filter((risk) => risk.type === "WEAK_PRODUCT_IDENTITY").length,
      affectedRecords: affectedRecords.length,
      affectedProducts: affectedProducts.length,
    },
    categoryQuality,
    risks: sortedRisks,
    affectedRecords,
    affectedProducts,
  };
}

function addDuplicateIdentifierRisks(
  risks: InventoryGroupingRisk[],
  recordsByIdentifier: Map<string, AnalyzerProductRecord[]>,
  type: "DUPLICATE_SERIAL" | "DUPLICATE_ASSET_TAG" | "DUPLICATE_ASSET_NUMBER",
  label: string,
): void {
  for (const [identifier, records] of recordsByIdentifier.entries()) {
    if (records.filter((record) => activeRecord(record.item)).length < 2) continue;

    risks.push(baseRisk(
      type,
      "CRITICAL",
      records,
      `Duplicate ${label} ${identifier} appears on ${records.length} inventory records.`,
      { identifiers: [identifier] },
    ));
  }
}

function addPossibleDuplicateProductRisks(
  risks: InventoryGroupingRisk[],
  recordsByIdentity: Map<string, AnalyzerProductRecord[]>,
  label: string,
  severity: InventoryGroupingRiskSeverity,
): void {
  for (const [identity, records] of recordsByIdentity.entries()) {
    const productIds = unique(records.map((record) => record.item.productId));
    if (!identity || productIds.length < 2) continue;

    risks.push(baseRisk(
      "POSSIBLE_DUPLICATE_PRODUCT",
      severity,
      records,
      `Same ${label} appears across multiple product IDs: ${productIds.join(", ")}.`,
      {
        identifiers: productIds,
        confidence: label === "SKU" ? "HIGH" : "MEDIUM",
      },
    ));
  }
}

function severityRank(severity: InventoryGroupingRiskSeverity): number {
  switch (severity) {
    case "CRITICAL":
      return 0;
    case "HIGH":
      return 1;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 3;
    default:
      return 4;
  }
}
