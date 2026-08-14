import { FieldValue, type Firestore, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { enforceCallableRateLimit } from "../security/rateLimit.js";
import { requireStaffOrAdmin } from "./auth.js";
import { assertOperationId, assertSafeDocId, text } from "../domainWorkflows/shared.js";
import {
  createInventoryMovementInTransaction,
  type CreateMovementInput,
  type MovementActor,
  normalizeScanValue,
} from "./movementService.js";
import {
  type InventoryScanField,
  resolveInventoryScan,
} from "./inventoryScanResolver.js";
import type {
  ReceiveScannedInventoryIntakeInput,
  ReceiveScannedInventoryIntakeResult,
} from "./types.js";

const MAX_INTAKE_QUANTITY = 1000;
const INVENTORY_COLLECTION = "inventory";
const PRODUCTS_COLLECTION = "products";
const OPERATIONS_COLLECTION = "inventoryOperations";
const PENDING_SCAN_SOURCE = "scan_in_unmatched";
const PRODUCT_MATCH_SOURCE = "product_catalog_scan";
const PENDING_SCAN_FIELDS: InventoryScanField[] = [
  "serial",
  "barcode",
  "lotNumber",
  "sku",
];
const PRODUCT_MATCH_INVENTORY_FIELDS: InventoryScanField[] = [
  "barcode",
  "serial",
  "serialNumber",
  "lotNumber",
  "sku",
  "manufacturerItemId",
];

type InventoryResolutionPlan = {
  inventoryId: string;
  createdOrMerged: "created" | "merged";
  inventoryData: Record<string, unknown>;
  inventorySeed?: Record<string, unknown>;
  metadataAfterMovement?: Record<string, unknown>;
};

function buildSearchText(values: Array<string | undefined>): string {
  return values
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sanitizeScanDocId(prefix: string, normalizedScan: string): string {
  return `${prefix}-${encodeURIComponent(normalizedScan)}`;
}

function buildProductScanDocId(productId: string, normalizedScan: string): string {
  return `product-scan-${productId}-${encodeURIComponent(normalizedScan)}`;
}

function buildPendingScanDocId(normalizedScan: string): string {
  return sanitizeScanDocId("pending-scan", normalizedScan);
}

function isInactiveOrDeletedProduct(product: Record<string, unknown>): boolean {
  const status = text(product.status).toLowerCase();
  return (
    product.deleted === true ||
    product.isDeleted === true ||
    status === "inactive" ||
    status === "discontinued"
  );
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function preferString(newValue: unknown, existing: unknown): string {
  const next = normalizeString(newValue);
  if (next) return next;
  return text(existing);
}

function preferNumber(newValue: number | undefined, existing: unknown, fallback = 0): number {
  if (typeof newValue === "number" && Number.isFinite(newValue)) return newValue;
  if (typeof existing === "number" && Number.isFinite(existing)) return existing;
  return fallback;
}

function isPendingScanRecord(data: Record<string, unknown>): boolean {
  return data.pendingScanReview === true && text(data.scanSource) === PENDING_SCAN_SOURCE;
}

function normalizeInventoryStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  return normalized === "discontinued" ? "discontinued" : "available";
}

function parseQuantity(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new HttpsError("invalid-argument", "Quantity must be a finite positive integer.");
  }
  if (raw <= 0) {
    throw new HttpsError("invalid-argument", "Quantity must be greater than zero.");
  }
  if (!Number.isInteger(raw)) {
    throw new HttpsError("invalid-argument", "Decimal quantities are not allowed.");
  }
  if (raw > MAX_INTAKE_QUANTITY) {
    throw new HttpsError(
      "invalid-argument",
      `Quantity cannot exceed ${MAX_INTAKE_QUANTITY.toLocaleString()} per intake transaction.`,
    );
  }
  return raw;
}

async function findExistingPendingScanInventory(
  transaction: FirebaseFirestore.Transaction,
  database: Firestore,
  normalizedScan: string,
): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const stableId = buildPendingScanDocId(normalizedScan);
  const stableRef = database.collection(INVENTORY_COLLECTION).doc(stableId);
  const stableSnap = await transaction.get(stableRef);
  if (stableSnap.exists) {
    const data = stableSnap.data() as Record<string, unknown>;
    if (data.isDeleted !== true && isPendingScanRecord(data)) {
      return { id: stableSnap.id, data };
    }
  }

  const resolved = await resolveInventoryScan(database, normalizedScan, {
    fields: PENDING_SCAN_FIELDS,
    includeUppercaseVariant: false,
    transaction,
    candidateFilter: (candidate) =>
      candidate.data.pendingScanReview === true &&
      text(candidate.data.scanSource) === PENDING_SCAN_SOURCE,
  });

  if (resolved.kind === "resolved") {
    return { id: resolved.inventoryItemId, data: resolved.inventory };
  }

  if (resolved.kind === "ambiguous") {
    throw new HttpsError(
      "failed-precondition",
      "Multiple pending scan intake records match this scan code.",
    );
  }

  return null;
}

async function findExistingProductMatchInventory(
  transaction: FirebaseFirestore.Transaction,
  database: Firestore,
  productId: string,
  normalizedScan: string,
): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const stableId = buildProductScanDocId(productId, normalizedScan);
  const stableRef = database.collection(INVENTORY_COLLECTION).doc(stableId);
  const stableSnap = await transaction.get(stableRef);
  if (stableSnap.exists) {
    const data = stableSnap.data() as Record<string, unknown>;
    if (data.isDeleted !== true) {
      return { id: stableSnap.id, data };
    }
  }

  const exactScan = await resolveInventoryScan(database, normalizedScan, {
    fields: PRODUCT_MATCH_INVENTORY_FIELDS,
    includeUppercaseVariant: false,
    transaction,
  });

  if (exactScan.kind === "resolved") {
    return { id: exactScan.inventoryItemId, data: exactScan.inventory };
  }

  if (exactScan.kind === "ambiguous") {
    throw new HttpsError(
      "failed-precondition",
      "Multiple inventory records match this product scan code.",
    );
  }

  const productSnap = await transaction.get(
    database
      .collection(INVENTORY_COLLECTION)
      .where("productId", "==", productId)
      .where("isDeleted", "!=", true)
      .limit(10),
  );
  const productMatches = productSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    data: docSnap.data() as Record<string, unknown>,
  }));
  if (productMatches.length === 1) {
    const { id, data } = productMatches[0];
    return { id, data };
  }

  return null;
}

async function ensureProductMatchInventory(
  transaction: FirebaseFirestore.Transaction,
  database: Firestore,
  productId: string,
  product: Record<string, unknown>,
  normalizedScan: string,
  locationName: string,
): Promise<InventoryResolutionPlan> {
  const existing = await findExistingProductMatchInventory(transaction, database, productId, normalizedScan);
  const productStatus = text(product.status).toLowerCase();
  const defaultName = text(product.name) || `Scanned product ${normalizedScan}`;
  const defaultCategory = text(product.category) || "Uncategorized";
  const defaultBarcode = normalizeString(product.upc) || normalizedScan;
  const defaultSku = normalizeString(product.sku) || normalizedScan;
  const defaultHcpc = normalizeString(product.hcpcs).toUpperCase();
  const defaultManufacturer = normalizeString(product.manufacturer);
  const defaultManufacturerItemId = normalizeString(product.manufacturerItemId);
  const defaultModel = normalizeString(product.model);
  const defaultReorderLevel = preferNumber(
    typeof product.reorderLevel === "number" ? product.reorderLevel : undefined,
    product.reorderLevel,
    0,
  );
  const defaultUnitCost = preferNumber(
    typeof product.defaultPurchasePrice === "number" ? product.defaultPurchasePrice : undefined,
    product.defaultPurchasePrice,
    0,
  );
  const name = defaultName;
  const category = defaultCategory;
  const barcode = defaultBarcode;
  const sku = defaultSku;
  const hcpc = defaultHcpc;
  const manufacturer = defaultManufacturer;
  const manufacturerItemId = defaultManufacturerItemId;
  const modelNumber = defaultModel;
  const status = normalizeInventoryStatus(productStatus);
  const note = `Created automatically from product catalog scan ${normalizedScan}.`;
  const searchText = buildSearchText([
    name,
    category,
    manufacturer,
    manufacturerItemId,
    sku,
    hcpc,
    barcode,
    normalizedScan,
  ]);
  const now = Timestamp.now();

  if (existing) {
    const updateData: Record<string, unknown> = {
      productId,
      name: preferString(product.name, existing.data.name),
      category: preferString(product.category, existing.data.category),
      manufacturer: preferString(product.manufacturer, existing.data.manufacturer),
      manufacturerItemId: preferString(product.manufacturerItemId, existing.data.manufacturerItemId),
      sku: preferString(product.sku, existing.data.sku),
      hcpc: preferString(product.hcpcs ? String(product.hcpcs).toUpperCase() : undefined, existing.data.hcpc),
      barcode: preferString(defaultBarcode, existing.data.barcode),
      modelNumber: preferString(product.model, existing.data.modelNumber),
      reorderLevel: preferNumber(product.reorderLevel as number | undefined, existing.data.reorderLevel, 0),
      unitCost: preferNumber(product.defaultPurchasePrice as number | undefined, existing.data.unitCost, 0),
      status: text(existing.data.status) || status,
      lifecycleStatus: text(existing.data.lifecycleStatus) || "active",
      notes: preferString(note, existing.data.notes),
      pendingScanReview: false,
      scanSource: PRODUCT_MATCH_SOURCE,
      lastScannedAt: now,
      lastScanDirection: "in",
      searchText,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (locationName) {
      updateData.locationName = locationName;
    }

    return {
      inventoryId: existing.id,
      createdOrMerged: "merged",
      inventoryData: {
        ...existing.data,
        ...updateData,
      },
      metadataAfterMovement: updateData,
    };
  }

  const docRef = database.collection(INVENTORY_COLLECTION).doc(buildProductScanDocId(productId, normalizedScan));
  const createData: Record<string, unknown> = {
    productId,
    name,
    category,
    sku,
    hcpc,
    barcode,
    serial: "",
    lotNumber: "",
    locationName: locationName || "Main Location",
    binLocation: "",
    quantityOnHand: 0,
    committed: 0,
    onRent: 0,
    onOrder: 0,
    available: 0,
    reorderLevel: defaultReorderLevel,
    unitCost: defaultUnitCost,
    totalValue: 0,
    status,
    manufacturer,
    manufacturerItemId,
    modelNumber,
    warrantyProvider: "",
    warrantyStartDate: "",
    warrantyEndDate: "",
    warrantyNotes: "",
    purchaseDate: "",
    usefulLifeMonths: 0,
    lifecycleStatus: "active",
    nextServiceDate: "",
    lifecycleNotes: "",
    notes: note,
    pendingScanReview: false,
    scanSource: PRODUCT_MATCH_SOURCE,
    sourceId: productId,
    searchText,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };

  return {
    inventoryId: docRef.id,
    createdOrMerged: "created",
    inventoryData: createData,
    inventorySeed: createData,
  };
}

async function ensurePendingScanInventory(
  transaction: FirebaseFirestore.Transaction,
  database: Firestore,
  normalizedScan: string,
  locationName: string,
): Promise<InventoryResolutionPlan> {
  const existing = await findExistingPendingScanInventory(transaction, database, normalizedScan);
  const name = `Pending scanned item ${normalizedScan}`;
  const category = "Pending Scan Review";
  const searchText = buildSearchText([name, category, normalizedScan]);
  const now = Timestamp.now();

  if (existing) {
    const updateData: Record<string, unknown> = {
      pendingScanReview: true,
      scanSource: PENDING_SCAN_SOURCE,
      locationName: locationName || "Main Location",
      lastScannedAt: now,
      lastScanDirection: "in",
      searchText,
      updatedAt: FieldValue.serverTimestamp(),
    };

    return {
      inventoryId: existing.id,
      createdOrMerged: "merged",
      inventoryData: {
        ...existing.data,
        ...updateData,
      },
      metadataAfterMovement: updateData,
    };
  }

  const docRef = database.collection(INVENTORY_COLLECTION).doc(buildPendingScanDocId(normalizedScan));
  const createData: Record<string, unknown> = {
    productId: "",
    name,
    category,
    sku: "",
    hcpc: "",
    barcode: "",
    serial: normalizedScan,
    lotNumber: "",
    locationName: locationName || "Main Location",
    binLocation: "",
    quantityOnHand: 0,
    committed: 0,
    onRent: 0,
    onOrder: 0,
    available: 0,
    reorderLevel: 0,
    unitCost: 0,
    totalValue: 0,
    status: "available",
    manufacturer: "",
    manufacturerItemId: "",
    modelNumber: "",
    warrantyProvider: "",
    warrantyStartDate: "",
    warrantyEndDate: "",
    warrantyNotes: "",
    purchaseDate: "",
    usefulLifeMonths: 0,
    lifecycleStatus: "active",
    nextServiceDate: "",
    lifecycleNotes: "",
    notes: "Created automatically from an unmatched Scan In. Review and complete item details.",
    pendingScanReview: true,
    scanSource: PENDING_SCAN_SOURCE,
    sourceId: normalizedScan,
    searchText,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };

  return {
    inventoryId: docRef.id,
    createdOrMerged: "created",
    inventoryData: createData,
    inventorySeed: createData,
  };
}

function buildIntakeRequestFingerprint(params: {
  actorUid: string;
  mode: string;
  productId?: string;
  normalizedScan: string;
  rawScan: string;
  quantity: number;
  locationId?: string;
}): string {
  return JSON.stringify({
    actorUid: params.actorUid,
    mode: params.mode,
    productId: params.productId ?? "",
    normalizedScan: params.normalizedScan,
    rawScan: params.rawScan,
    quantity: params.quantity,
    locationId: params.locationId ?? "",
  });
}

function buildStoredResult(data: Record<string, unknown>): ReceiveScannedInventoryIntakeResult | null {
  if (text(data.status) !== "success") return null;
  const inventoryItemId = text(data.inventoryItemId);
  const movementId = text(data.movementId);
  const quantityBefore = typeof data.quantityBefore === "number" ? data.quantityBefore : null;
  const quantityChange = typeof data.quantityChange === "number" ? data.quantityChange : null;
  const quantityAfter = typeof data.quantityAfter === "number" ? data.quantityAfter : null;
  const createdOrMerged = text(data.createdOrMerged) as "created" | "merged";
  const mode = text(data.mode) as "product-match" | "pending-scan";
  if (!inventoryItemId || !movementId || quantityBefore === null || quantityChange === null || quantityAfter === null || !createdOrMerged || !mode) {
    return null;
  }

  return {
    status: "success",
    inventoryItemId,
    movementId,
    quantityBefore,
    quantityChange,
    quantityAfter,
    createdOrMerged,
    mode,
  };
}

export async function receiveScannedInventoryIntake(
  input: ReceiveScannedInventoryIntakeInput,
  actor: MovementActor,
  database: Firestore = getFirestore(),
): Promise<ReceiveScannedInventoryIntakeResult> {
  if (!input || typeof input !== "object") {
    throw new HttpsError("invalid-argument", "Request body is required.");
  }

  assertOperationId(input.operationId);

  if (typeof input.rawScan !== "string" || !input.rawScan.trim()) {
    throw new HttpsError("invalid-argument", "rawScan is required.");
  }

  const parsedScan = normalizeScanValue(input.rawScan);
  if (parsedScan.status === "invalid") {
    throw new HttpsError("invalid-argument", parsedScan.error ?? "Invalid scan.");
  }

  if (typeof input.normalizedScan !== "string" || input.normalizedScan.trim() === "") {
    throw new HttpsError("invalid-argument", "normalizedScan is required.");
  }

  if (input.normalizedScan !== parsedScan.value) {
    throw new HttpsError(
      "invalid-argument",
      "normalizedScan does not match normalized rawScan.",
    );
  }

  if (typeof input.mode !== "string" || !["product-match", "pending-scan"].includes(input.mode)) {
    throw new HttpsError("invalid-argument", "mode is required.");
  }

  const quantity = parseQuantity(input.quantity);
  const locationName = typeof input.locationId === "string" && input.locationId.trim() ? input.locationId.trim() : "Main Location";

  return database.runTransaction(async (transaction) => {
    const operationRef = database.collection(OPERATIONS_COLLECTION).doc(`${actor.uid}_${input.operationId}`);
    const opSnap = await transaction.get(operationRef);
    const intakeFingerprint = buildIntakeRequestFingerprint({
      actorUid: actor.uid,
      mode: input.mode,
      productId: input.mode === "product-match" ? input.productId : undefined,
      normalizedScan: parsedScan.value,
      rawScan: input.rawScan,
      quantity,
      locationId: input.locationId,
    });

    if (opSnap.exists) {
      const opData = opSnap.data() as Record<string, unknown>;
      if (text(opData.intakeRequestFingerprint) && opData.intakeRequestFingerprint !== intakeFingerprint) {
        throw new HttpsError(
          "failed-precondition",
          "This operationId was already used with different request data.",
        );
      }

      const stored = buildStoredResult(opData.intakeResult as Record<string, unknown>);
      if (stored) {
        return stored;
      }

      throw new HttpsError(
        "failed-precondition",
        "This operationId has already been processed.",
      );
    }

    let inventoryOutcome: InventoryResolutionPlan;
    let productId: string | undefined;
    let itemRef: FirebaseFirestore.DocumentReference<Record<string, unknown>>;

    if (input.mode === "product-match") {
      if (typeof input.productId !== "string" || !input.productId.trim()) {
        throw new HttpsError("invalid-argument", "productId is required for product-match mode.");
      }
      assertSafeDocId(input.productId, "productId");
      const productRef = database.collection(PRODUCTS_COLLECTION).doc(input.productId);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists) {
        throw new HttpsError("not-found", "Product was not found.");
      }
      const product = productSnap.data() as Record<string, unknown>;
      if (isInactiveOrDeletedProduct(product)) {
        throw new HttpsError("failed-precondition", "Product is inactive, discontinued, or deleted.");
      }
      const productResult = await ensureProductMatchInventory(
        transaction,
        database,
        input.productId,
        product,
        parsedScan.value,
        locationName,
      );
      inventoryOutcome = productResult;
      productId = input.productId;
      itemRef = database.collection(INVENTORY_COLLECTION).doc(inventoryOutcome.inventoryId);
    } else {
      const pendingResult = await ensurePendingScanInventory(
        transaction,
        database,
        parsedScan.value,
        locationName,
      );
      inventoryOutcome = pendingResult;
      itemRef = database.collection(INVENTORY_COLLECTION).doc(inventoryOutcome.inventoryId);
    }

    const inventoryData = inventoryOutcome.inventoryData;
    const movementInput: CreateMovementInput & { inventoryItemId: string } = {
      operationId: input.operationId,
      movementType: "receive",
      inventoryItemId: inventoryOutcome.inventoryId,
      productId,
      barcode: text(inventoryData.barcode) || parsedScan.value,
      serialNumber: text(inventoryData.serial) || text(inventoryData.serialNumber) || (input.mode === "pending-scan" ? parsedScan.value : undefined),
      lotNumber: text(inventoryData.lotNumber) || undefined,
      quantity,
      reason:
        input.mode === "product-match"
          ? "Scanned in from product catalog intake."
          : "Created pending intake record from unmatched scan.",
      source: "scanner",
      toLocation: input.locationId ?? undefined,
      metadata: {
        intakeMode: input.mode,
        normalizedScan: parsedScan.value,
        rawScan: input.rawScan,
        scanSource: input.mode === "product-match" ? PRODUCT_MATCH_SOURCE : PENDING_SCAN_SOURCE,
        createdOrMerged: inventoryOutcome.createdOrMerged,
      },
    };

    const movement = await createInventoryMovementInTransaction({
      transaction,
      database,
      input: movementInput,
      actor,
      inventorySeed: inventoryOutcome.inventorySeed,
    });

    if (movement.status !== "success" && movement.status !== "duplicate_operation") {
      throw new HttpsError(
        movement.status === "permission_denied" ? "permission-denied" : "failed-precondition",
        movement.message || "Inventory intake failed.",
      );
    }

    const result: ReceiveScannedInventoryIntakeResult = {
      status: "success",
      inventoryItemId: inventoryOutcome.inventoryId,
      movementId: movement.movementId ?? "",
      quantityBefore: movement.quantityBefore ?? 0,
      quantityChange: movement.quantityDelta ?? quantity,
      quantityAfter: movement.quantityAfter ?? 0,
      createdOrMerged: inventoryOutcome.createdOrMerged,
      mode: input.mode,
    };

    if (inventoryOutcome.metadataAfterMovement) {
      transaction.set(itemRef, inventoryOutcome.metadataAfterMovement, { merge: true });
    }

    transaction.set(
      operationRef,
      {
        intakeRequestFingerprint: intakeFingerprint,
        intakeMode: input.mode,
        intakeResult: result,
      },
      { merge: true },
    );

    return result;
  });
}

export const receiveScannedInventoryIntakeCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    await enforceCallableRateLimit(request, "general");
    const actor = await requireStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;
    if (!data) {
      throw new HttpsError("invalid-argument", "Request body is required.");
    }

    const mode = text(data.mode) as "product-match" | "pending-scan";
    const input = {
      mode,
      rawScan: text(data.rawScan),
      normalizedScan: text(data.normalizedScan),
      quantity: Number(data.quantity),
      operationId: text(data.operationId),
      locationId: typeof data.locationId === "string" ? data.locationId.trim() : undefined,
      productId: typeof data.productId === "string" ? data.productId.trim() : undefined,
    } as ReceiveScannedInventoryIntakeInput;

    return receiveScannedInventoryIntake(input, actor, getFirestore());
  },
);
