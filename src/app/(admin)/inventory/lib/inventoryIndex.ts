import { normalizeSearchText } from "./inventoryNormalize";
import type { InventoryItem } from "./inventoryTypes";

export type InventoryIndexTotals = {
  totalUnits: number;
  totalQuantity: number;
  available: number;
  checkedOut: number;
  service: number;
  other: number;
};

export type InventoryCategoryDefinition = {
  id: string;
  name: string;
  sortOrder: number;
  aliases: string[];
};

export type InventoryUnitNode = {
  id: string;
  label: string;
  serialNumber: string;
  lotNumber: string;
  locationName: string;
  status: InventoryItem["status"];
  lifecycleStatus: InventoryItem["lifecycleStatus"];
  quantityOnHand: number;
  available: number;
  isSerialized: boolean;
  searchText: string;
  item: InventoryItem;
};

export type InventoryLocationQuantityNode = {
  key: string;
  locationName: string;
  lotNumber: string;
  quantityOnHand: number;
  available: number;
  recordCount: number;
  records: InventoryItem[];
};

export type InventoryProductNode = {
  key: string;
  productId: string;
  productName: string;
  productType: string;
  manufacturer: string;
  modelNumber: string;
  sku: string;
  hcpc: string;
  isSerialized: boolean;
  totals: InventoryIndexTotals;
  units: InventoryUnitNode[];
  quantities: InventoryLocationQuantityNode[];
  records: InventoryItem[];
  searchText: string;
};

export type InventoryCategoryNode = {
  id: string;
  name: string;
  sortOrder: number;
  totals: InventoryIndexTotals;
  products: InventoryProductNode[];
  searchText: string;
};

export type InventoryIndexRisk = {
  itemId: string;
  type:
    | "missing_category"
    | "missing_product_identity"
    | "duplicate_serial";
  message: string;
};

export type InventoryIndex = {
  categories: InventoryCategoryNode[];
  risks: InventoryIndexRisk[];
};

const UNCATEGORIZED: InventoryCategoryDefinition = {
  id: "uncategorized",
  name: "Uncategorized",
  sortOrder: 9999,
  aliases: [],
};

export const DEFAULT_INVENTORY_CATEGORIES: InventoryCategoryDefinition[] = [
  { id: "oxygen-equipment", name: "Oxygen Equipment", sortOrder: 10, aliases: ["oxygen", "o2", "concentrator", "portable oxygen"] },
  { id: "cpap-pap", name: "CPAP / PAP", sortOrder: 20, aliases: ["cpap", "bipap", "pap", "resmed", "dreamstation"] },
  { id: "respiratory", name: "Respiratory", sortOrder: 30, aliases: ["nebulizer", "suction", "respiratory"] },
  { id: "mobility", name: "Mobility", sortOrder: 40, aliases: ["wheelchair", "walker", "rollator", "mobility"] },
  { id: "hospital-beds", name: "Hospital Beds", sortOrder: 50, aliases: ["hospital bed", "bed rail", "mattress"] },
  { id: "patient-room-equipment", name: "Patient Room Equipment", sortOrder: 60, aliases: ["commode", "overbed", "patient room"] },
  { id: "bathroom-safety", name: "Bathroom Safety", sortOrder: 70, aliases: ["bath", "shower", "toilet safety"] },
  { id: "supplies", name: "Supplies", sortOrder: 80, aliases: ["supply", "supplies", "cannula", "tubing", "mask", "filter"] },
  { id: "accessories-parts", name: "Accessories / Replacement Parts", sortOrder: 90, aliases: ["accessory", "accessories", "replacement", "part"] },
  UNCATEGORIZED,
];

type MutableProductNode = Omit<InventoryProductNode, "units" | "quantities" | "records"> & {
  units: InventoryUnitNode[];
  quantities: Map<string, InventoryLocationQuantityNode>;
  records: InventoryItem[];
};

type MutableCategoryNode = Omit<InventoryCategoryNode, "products"> & {
  products: Map<string, MutableProductNode>;
};

export type InventoryCategoryResolution = {
  definition: InventoryCategoryDefinition;
  source: "explicit" | "inferred" | "fallback";
  isKnownDefinition: boolean;
};

export type InventoryIndexIdentity = {
  category: InventoryCategoryDefinition;
  categorySource: InventoryCategoryResolution["source"];
  categoryIsKnownDefinition: boolean;
  productKey: string;
  serialIdentifier: string;
  isSerialized: boolean;
  quantityKey: string;
};

export function cleanInventoryIndexValue(value: string | undefined): string {
  return String(value ?? "").trim();
}

function display(value: string | undefined, fallback: string): string {
  return cleanInventoryIndexValue(value) || fallback;
}

export function stableInventoryIndexId(value: string): string {
  const normalized = normalizeSearchText(value).replaceAll(" ", "-");
  return normalized || UNCATEGORIZED.id;
}

export function getInventoryProductGroupingKey(item: InventoryItem): string {
  if (cleanInventoryIndexValue(item.productId)) return `product:${item.productId}`;

  const fallbackParts = [
    cleanInventoryIndexValue(item.manufacturer),
    cleanInventoryIndexValue(item.modelNumber),
    cleanInventoryIndexValue(item.sku),
    cleanInventoryIndexValue(item.hcpc),
    cleanInventoryIndexValue(item.name),
  ].filter(Boolean);

  return `legacy:${fallbackParts.join("|") || item.id}`;
}

export function getInventorySerialIdentifier(item: InventoryItem): string {
  return cleanInventoryIndexValue(item.serial) || cleanInventoryIndexValue(item.assetTag) || cleanInventoryIndexValue(item.assetNumber);
}

export function isSerializedInventoryItem(item: InventoryItem): boolean {
  return Boolean(getInventorySerialIdentifier(item));
}

export function resolveInventoryCategory(
  item: InventoryItem,
  definitions: InventoryCategoryDefinition[],
): InventoryCategoryResolution {
  const category = cleanInventoryIndexValue(item.category);
  if (category) {
    const exact = definitions.find((definition) =>
      definition.name.toLowerCase() === category.toLowerCase() ||
      definition.id === stableInventoryIndexId(category) ||
      definition.aliases.some((alias) => alias.toLowerCase() === category.toLowerCase())
    );

    return exact
      ? {
          definition: exact,
          source: "explicit",
          isKnownDefinition: true,
        }
      : {
          definition: {
            id: stableInventoryIndexId(category),
            name: category,
            sortOrder: 500,
            aliases: [],
          },
          source: "explicit",
          isKnownDefinition: false,
        };
  }

  const haystack = normalizeSearchText([
    item.name,
    item.manufacturer,
    item.modelNumber,
    item.sku,
    item.hcpc,
    item.notes,
  ].join(" "));

  const inferred = definitions.find((definition) =>
    definition.id !== UNCATEGORIZED.id &&
    definition.aliases.some((alias) => haystack.includes(normalizeSearchText(alias)))
  );

  if (inferred) {
    return {
      definition: inferred,
      source: "inferred",
      isKnownDefinition: true,
    };
  }

  return {
    definition: UNCATEGORIZED,
    source: "fallback",
    isKnownDefinition: true,
  };
}

export function getInventoryQuantityGroupingKey(item: InventoryItem): string {
  return [
    display(item.locationName, "Unknown Location"),
    display(item.lotNumber, "No lot"),
  ].join("|");
}

export function classifyInventoryIndexItem(
  item: InventoryItem,
  definitions: readonly InventoryCategoryDefinition[] = DEFAULT_INVENTORY_CATEGORIES,
): InventoryIndexIdentity {
  const category = resolveInventoryCategory(item, [...definitions]);

  return {
    category: category.definition,
    categorySource: category.source,
    categoryIsKnownDefinition: category.isKnownDefinition,
    productKey: getInventoryProductGroupingKey(item),
    serialIdentifier: getInventorySerialIdentifier(item),
    isSerialized: isSerializedInventoryItem(item),
    quantityKey: getInventoryQuantityGroupingKey(item),
  };
}

function searchTextForItem(item: InventoryItem): string {
  return normalizeSearchText([
    item.searchText,
    item.category,
    item.name,
    item.productId,
    item.manufacturer,
    item.modelNumber,
    item.sku,
    item.hcpc,
    item.barcode,
    item.serial,
    item.assetTag,
    item.assetNumber,
    item.lotNumber,
    item.locationName,
    item.status,
    item.lifecycleStatus,
  ].join(" "));
}

function emptyTotals(): InventoryIndexTotals {
  return {
    totalUnits: 0,
    totalQuantity: 0,
    available: 0,
    checkedOut: 0,
    service: 0,
    other: 0,
  };
}

function addItemToTotals(totals: InventoryIndexTotals, item: InventoryItem): void {
  const serialized = isSerializedInventoryItem(item);
  const quantity = serialized ? 1 : item.quantityOnHand;
  totals.totalUnits += serialized ? 1 : 0;
  totals.totalQuantity += quantity;

  if (item.lifecycleStatus === "needs_service") {
    totals.service += quantity;
  } else if (item.status === "available") {
    totals.available += serialized ? 1 : item.available;
  } else if (item.status === "rental_out" || item.onRent > 0) {
    totals.checkedOut += serialized ? 1 : item.onRent;
  } else {
    totals.other += quantity;
  }
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

export function buildInventoryIndex(params: {
  inventoryItems: readonly InventoryItem[];
  categories?: readonly InventoryCategoryDefinition[];
}): InventoryIndex {
  const definitions = [...(params.categories ?? DEFAULT_INVENTORY_CATEGORIES)];
  const categories = new Map<string, MutableCategoryNode>();
  const risks: InventoryIndexRisk[] = [];
  const serialPaths = new Map<string, string[]>();

  for (const item of params.inventoryItems) {
    const identity = classifyInventoryIndexItem(item, definitions);
    const categoryDefinition = identity.category;
    const category = categories.get(categoryDefinition.id) ?? {
      id: categoryDefinition.id,
      name: categoryDefinition.name,
      sortOrder: categoryDefinition.sortOrder,
      totals: emptyTotals(),
      products: new Map<string, MutableProductNode>(),
      searchText: normalizeSearchText(categoryDefinition.name),
    };

    if (!cleanInventoryIndexValue(item.category)) {
      risks.push({
        itemId: item.id,
        type: "missing_category",
        message: `Inventory item ${item.id} has no category and was indexed under ${category.name}.`,
      });
    }

    const productKey = identity.productKey;
    if (!cleanInventoryIndexValue(item.productId) && !cleanInventoryIndexValue(item.sku) && !cleanInventoryIndexValue(item.modelNumber) && !cleanInventoryIndexValue(item.name)) {
      risks.push({
        itemId: item.id,
        type: "missing_product_identity",
        message: `Inventory item ${item.id} has no stable product identity fields.`,
      });
    }

    const product = category.products.get(productKey) ?? {
      key: productKey,
      productId: cleanInventoryIndexValue(item.productId),
      productName: display(item.name, "Unknown Product"),
      productType: display(item.category, category.name),
      manufacturer: display(item.manufacturer, "-"),
      modelNumber: display(item.modelNumber, "-"),
      sku: display(item.sku, "-"),
      hcpc: display(item.hcpc, "-"),
      isSerialized: false,
      totals: emptyTotals(),
      units: [],
      quantities: new Map<string, InventoryLocationQuantityNode>(),
      records: [],
      searchText: "",
    };

    const itemSearchText = searchTextForItem(item);
    const serialized = identity.isSerialized;
    product.isSerialized = product.isSerialized || serialized;
    product.records.push(item);
    product.searchText = normalizeSearchText(`${product.searchText} ${itemSearchText}`);
    category.searchText = normalizeSearchText(`${category.searchText} ${itemSearchText}`);
    addItemToTotals(product.totals, item);
    addItemToTotals(category.totals, item);

    if (serialized) {
      const serial = identity.serialIdentifier;
      const serialKey = normalizeSearchText(serial);
      serialPaths.set(serialKey, [...(serialPaths.get(serialKey) ?? []), item.id]);
      product.units.push({
        id: item.id,
        label: `SN#${serial}`,
        serialNumber: serial,
        lotNumber: cleanInventoryIndexValue(item.lotNumber),
        locationName: display(item.locationName, "Unknown Location"),
        status: item.status,
        lifecycleStatus: item.lifecycleStatus,
        quantityOnHand: item.quantityOnHand,
        available: item.available,
        isSerialized: true,
        searchText: itemSearchText,
        item,
      });
    } else {
      const quantityKey = identity.quantityKey;
      const quantity = product.quantities.get(quantityKey) ?? {
        key: quantityKey,
        locationName: display(item.locationName, "Unknown Location"),
        lotNumber: cleanInventoryIndexValue(item.lotNumber),
        quantityOnHand: 0,
        available: 0,
        recordCount: 0,
        records: [],
      };
      quantity.quantityOnHand += item.quantityOnHand;
      quantity.available += item.available;
      quantity.recordCount += 1;
      quantity.records.push(item);
      product.quantities.set(quantityKey, quantity);
    }

    category.products.set(productKey, product);
    categories.set(category.id, category);
  }

  for (const [serial, itemIds] of serialPaths.entries()) {
    if (serial && itemIds.length > 1) {
      itemIds.forEach((itemId) => {
        risks.push({
          itemId,
          type: "duplicate_serial",
          message: `Serial ${serial} appears on multiple inventory records: ${itemIds.join(", ")}.`,
        });
      });
    }
  }

  return {
    categories: Array.from(categories.values())
      .map((category) => ({
        ...category,
        products: Array.from(category.products.values())
          .map((product) => ({
            ...product,
            units: [...product.units].sort((left, right) =>
              compareText(left.serialNumber, right.serialNumber) || compareText(left.id, right.id)
            ),
            quantities: Array.from(product.quantities.values()).sort((left, right) =>
              compareText(left.locationName, right.locationName) || compareText(left.lotNumber, right.lotNumber)
            ),
            records: [...product.records].sort((left, right) => compareText(left.name, right.name) || compareText(left.id, right.id)),
          }))
          .sort((left, right) =>
            compareText(left.productName, right.productName) ||
            compareText(left.manufacturer, right.manufacturer) ||
            compareText(left.key, right.key)
          ),
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder || compareText(left.name, right.name)),
    risks: risks.sort((left, right) => compareText(left.type, right.type) || compareText(left.itemId, right.itemId)),
  };
}
