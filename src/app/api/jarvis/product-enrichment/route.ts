import { NextRequest, NextResponse } from "next/server";
import { FieldValue as AdminFieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebaseAdmin";
import { requireApiPermission } from "@/lib/auth/require-api-auth";
import { normalizeBarcode } from "@/lib/barcode";
import { findImageUrl, processProductImageUrl } from "@/services/jarvis/product-image.service";
import { lookupBarcodeProduct } from "@/services/jarvis/barcode-lookup.service";
import type { SearchResult } from "@/services/jarvis/product-enrichment-types";
import { identifySku, identifyProduct } from "@/services/jarvis/product-identification.service";
import {
  loadVendorResearchSites,
  extractDomain,
  decodeHtml,
} from "@/services/jarvis/web-search.service";

export const runtime = "nodejs";

type BarcodeLookupProduct = {
  title?: unknown;
  name?: unknown;
  description?: unknown;
  brand?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  mpn?: unknown;
  category?: unknown;
  images?: unknown;
  image?: unknown;
  barcode?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildSearchKeywords(values: string[]): string[] {
  return Array.from(new Set(normalizeSearchText(values.join(" ")).split(" ").filter(Boolean))).slice(0, 100);
}

function domainFromRecord(record: { url?: string }): string {
  const url = typeof record.url === "string" ? record.url : "";
  return extractDomain(url);
}

async function enrichInventory(body: Record<string, unknown>, actor: string) {
  const inventoryId = text(body.inventoryId);
  if (!inventoryId) {
    return NextResponse.json({ error: "inventoryId is required" }, { status: 400 });
  }

  const inventoryRef = adminDb.collection("inventory").doc(inventoryId);
  const inventorySnap = await inventoryRef.get();
  if (!inventorySnap.exists) {
    return NextResponse.json({ error: "Inventory record not found" }, { status: 404 });
  }

  const current = inventorySnap.data() ?? {};
  const code = normalizeBarcode(
    text(body.code) || text(current.serial) || text(current.barcode) || text(current.sku)
  );

  const vendorResearchSites = await loadVendorResearchSites();
  const preferredDomains = vendorResearchSites.map(domainFromRecord);

  const guess = await identifyProduct(
    [
      code,
      text(current.name).replace(/^Pending scanned item\s+/i, ""),
      text(current.manufacturer),
      text(current.modelNumber),
    ],
    preferredDomains
  );

  if (!guess) {
    return NextResponse.json({ error: "Jarvis could not identify a likely product." }, { status: 404 });
  }

  const name = guess.name || text(current.name);
  const category = guess.category || text(current.category) || "Pending Web Review";
  const sku = text(current.sku) || guess.sku;
  const upc = text(current.barcode) || guess.upc;
  const hcpcs = text(current.hcpc) || guess.hcpcs;
  const serial = text(current.serial) || (upc ? "" : code);
  const productId = normalizeSearchText(sku || upc || `${name}-${category}`).replace(/\s+/g, "-");
  const searchValues = [
    name,
    category,
    guess.manufacturer,
    guess.model,
    sku,
    upc,
    hcpcs,
  ];

  await adminDb.collection("products").doc(productId).set(
    {
      name,
      brand: guess.manufacturer,
      model: guess.model,
      category,
      productType: category === "CPAP" ? "cpap" : category === "Oxygen" ? "oxygen" : "resale",
      manufacturer: guess.manufacturer,
      manufacturerItemId: text(current.manufacturerItemId),
      primaryVendor: "",
      secondaryVendor: "",
      sku,
      upc,
      hcpcs,
      ndc: "",
      basePrice: 0,
      defaultPurchasePrice: Number(current.unitCost ?? 0),
      defaultRentalRate: 0,
      unitOfMeasure: "each",
      reorderLevel: Number(current.reorderLevel ?? 0),
      warrantyMonths: 0,
      weight: "",
      dimensions: "",
      imageUrl: guess.imageUrl,
      thumbnailUrl: guess.imageUrl,
      status: "active",
      isRentalItem: false,
      isSerialized: Boolean(serial),
      requiresPrescription: false,
      requiresSerialTracking: Boolean(serial),
      lotTracking: Boolean(current.lotNumber),
      expirationTracking: false,
      recallFlagged: false,
      notes: `Jarvis web enrichment. Source: ${guess.sourceUrl}`,
      deleted: false,
      searchText: normalizeSearchText(searchValues.join(" ")),
      searchKeywords: buildSearchKeywords(searchValues),
      jarvisWebEnrichedAt: AdminFieldValue.serverTimestamp(),
      jarvisWebEnrichment: {
        sourceUrl: guess.sourceUrl,
        imageUrl: guess.imageUrl,
        confidence: guess.confidence,
        queryCode: code,
      },
      updatedAt: AdminFieldValue.serverTimestamp(),
      updatedByEmail: actor,
    },
    { merge: true }
  );

  const inventorySearchValues = [
    name,
    category,
    sku,
    hcpcs,
    upc,
    serial,
    text(current.lotNumber),
    guess.manufacturer,
    guess.model,
  ];

  await inventoryRef.set(
    {
      productId,
      name,
      category,
      sku,
      hcpc: hcpcs,
      barcode: upc,
      serial,
      manufacturer: guess.manufacturer || text(current.manufacturer),
      modelNumber: guess.model || text(current.modelNumber),
      pendingScanReview: false,
      scanSource: "jarvis_web_identified",
      jarvisWebEnrichment: {
        sourceUrl: guess.sourceUrl,
        imageUrl: guess.imageUrl,
        confidence: guess.confidence,
        enrichedAt: AdminFieldValue.serverTimestamp(),
      },
      searchText: normalizeSearchText(inventorySearchValues.join(" ")),
      updatedAt: AdminFieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({
    productId,
    inventoryId,
    product: {
      name,
      category,
      sku,
      barcode: upc,
      serial,
      manufacturer: guess.manufacturer,
      modelNumber: guess.model,
      imageUrl: guess.imageUrl,
      sourceUrl: guess.sourceUrl,
      confidence: guess.confidence,
    },
  });
}

async function enrichProductImages(body: Record<string, unknown>, actor: string) {
  const ids = Array.isArray(body.productIds)
    ? body.productIds.map(text).filter(Boolean).slice(0, 25)
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "productIds are required" }, { status: 400 });
  }

  const vendorResearchSites = await loadVendorResearchSites();
  const preferredDomains = vendorResearchSites.map(domainFromRecord);

  const updated: Array<{ productId: string; imageUrl: string; sourceUrl: string }> = [];

  for (const productId of ids) {
    const ref = adminDb.collection("products").doc(productId);
    const snap = await ref.get();
    if (!snap.exists) continue;

    const product = snap.data() ?? {};
    if (text(product.imageUrl) && text(product.thumbnailUrl)) continue;

    const guess = await identifyProduct(
      [
        text(product.name),
        text(product.manufacturer),
        text(product.model),
        text(product.sku),
        text(product.upc),
        "stock product image",
      ],
      preferredDomains
    );

    if (!guess?.imageUrl) continue;

    await ref.set(
      {
        imageUrl: text(product.imageUrl) || guess.imageUrl,
        thumbnailUrl: text(product.thumbnailUrl) || guess.imageUrl,
        jarvisImageEnrichment: {
          sourceUrl: guess.sourceUrl,
          imageUrl: guess.imageUrl,
          confidence: guess.confidence,
          enrichedAt: AdminFieldValue.serverTimestamp(),
        },
        updatedAt: AdminFieldValue.serverTimestamp(),
        updatedByEmail: actor,
      },
      { merge: true }
    );

    updated.push({
      productId,
      imageUrl: guess.imageUrl,
      sourceUrl: guess.sourceUrl,
    });
  }

  return NextResponse.json({ updated });
}

type AutoFillRecord = Record<string, unknown>;

type JarvisProductReference = {
  itemNumber: string;
  description: string;
  category: string;
  model: string;
};

const BUILTIN_PRODUCT_REFERENCES: JarvisProductReference[] = [
  {
    itemNumber: "M170-1-314ELR",
    description: "14 inch Detachable Desk Length Flip Back Arms & Elevating Leg Rests",
    category: "Wheelchairs",
    model: "M170",
  },
  {
    itemNumber: "M170-1-314SF",
    description: "14 inch Detachable Desk Length Flip Back Arms & Swing Away Foot Rest",
    category: "Wheelchairs",
    model: "M170",
  },
  {
    itemNumber: "M170-1-316SF",
    description: "16 inch Detachable Desk Length Flip Back Arms & Swing Away Foot Rests",
    category: "Wheelchairs",
    model: "M170",
  },
  {
    itemNumber: "M170-1-316ELR",
    description: "16 inch Detachable Desk Length Flip Back Arms & Elevating Leg Rests",
    category: "Wheelchairs",
    model: "M170",
  },
  {
    itemNumber: "M170-1-318SF",
    description: "18 inch Detachable Desk Length Flip Back Arms & Swing Away Foot Rests",
    category: "Wheelchairs",
    model: "M170",
  },
  {
    itemNumber: "M170-1-318ELR",
    description: "18 inch Detachable Desk Length Flip Back Arms & Elevating Leg Rests",
    category: "Wheelchairs",
    model: "M170",
  },
  {
    itemNumber: "M170-1-320SF",
    description: "20 inch Detachable Desk Length Flip Back Arms & Swing Away Foot Rests",
    category: "Wheelchairs",
    model: "M170",
  },
  {
    itemNumber: "M170-1-320ELR",
    description: "20 inch Detachable Desk Length Flip Back Arms & Elevating Leg Rests",
    category: "Wheelchairs",
    model: "M170",
  },
  {
    itemNumber: "M170-3-316SF",
    description: "16 inch Adjustable Height Desk Arms & Swing Away Foot Rests",
    category: "Wheelchairs",
    model: "M170",
  },
  {
    itemNumber: "M170-3-316ELR",
    description: "16 inch Adjustable Height Desk Arms & Elevating Leg Rests",
    category: "Wheelchairs",
    model: "M170",
  },
  {
    itemNumber: "M170-3-318SF",
    description: "18 inch Adjustable Height Desk Arms & Swing Away Foot Rests",
    category: "Wheelchairs",
    model: "M170",
  },
  {
    itemNumber: "M170-3-318ELR",
    description: "18 inch Adjustable Height Desk Arms & Elevating Leg Rests",
    category: "Wheelchairs",
    model: "M170",
  },
  {
    itemNumber: "M170-3-320SF",
    description: "20 inch Adjustable Height Desk Arms & Swing Away Foot Rests",
    category: "Wheelchairs",
    model: "M170",
  },
  {
    itemNumber: "M170-3-320ELR",
    description: "20 inch Adjustable Height Desk Arms & Elevating Leg Rests",
    category: "Wheelchairs",
    model: "M170",
  },
];

type BlankField = {
  field: string;
  currentValue: unknown;
  sourceValue: unknown;
  confidence: number;
  sourceDocId: string;
  sourceCollection: string;
};

type AutoFillResult = {
  docId: string;
  collection: string;
  filledFields: BlankField[];
};

function normalizeItemNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function buildReferenceFields(reference: JarvisProductReference): Record<string, string> {
  return {
    name: `${reference.itemNumber} - ${reference.description}`,
    sku: reference.itemNumber,
    manufacturerItemId: reference.itemNumber,
    model: reference.model,
    category: reference.category,
  };
}

function findBuiltinProductReference(record: AutoFillRecord): JarvisProductReference | null {
  const values = [
    text(record.sku),
    text(record.manufacturerItemId),
    text(record.model),
    text(record.upc),
    text(record.barcode),
    text(record.name),
    text(record.searchText),
  ]
    .map(normalizeItemNumber)
    .filter(Boolean);

  if (!values.length) return null;

  return (
    BUILTIN_PRODUCT_REFERENCES.find((reference) => {
      const needle = normalizeItemNumber(reference.itemNumber);
      return values.some((value) => value === needle || value.includes(needle));
    }) ?? null
  );
}

async function loadSavedProductReferences(): Promise<JarvisProductReference[]> {
  try {
    const snapshot = await adminDb.collection("jarvisProductReferences").limit(500).get();
    return snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();
        return {
          itemNumber: text(data.itemNumber || data.sku || docSnap.id),
          description: text(data.description || data.name),
          category: text(data.category) || "Products",
          model: text(data.model),
        };
      })
      .filter((reference) => reference.itemNumber && reference.description);
  } catch {
    return [];
  }
}

async function autoFillBlankFields(
  collections: string[],
  actor: string
): Promise<AutoFillResult[]> {
  const results: AutoFillResult[] = [];
  const BATCH_SIZE = 25;
  const savedReferences = await loadSavedProductReferences();
  const productReferences = [...savedReferences, ...BUILTIN_PRODUCT_REFERENCES];

  for (const collectionName of collections) {
    const collectionRef = adminDb.collection(collectionName);

    const snapshot = await collectionRef.limit(BATCH_SIZE).get();

    if (snapshot.empty) {
      continue;
    }

    const blankCandidates: Array<{ docId: string; data: AutoFillRecord; blankFields: string[] }> = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const blankFields: string[] = [];

      const fieldKeys = [
        "name",
        "manufacturer",
        "manufacturerItemId",
        "model",
        "sku",
        "upc",
        "hcpcs",
        "category",
        "imageUrl",
        "thumbnailUrl",
        "barcode",
        "serial",
        "lotNumber",
        "locationName",
        "binLocation",
        "dimensions",
        "weight",
        "primaryVendor",
        "secondaryVendor",
        "warrantyMonths",
      ];

      for (const field of fieldKeys) {
        const value = data[field];
        if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
          blankFields.push(field);
        }
      }

      if (blankFields.length > 0) {
        blankCandidates.push({ docId: docSnap.id, data, blankFields });
      }
    }

    for (const candidate of blankCandidates) {
      const filledFields: BlankField[] = [];
      const updates: Record<string, unknown> = {};
      const reference = (() => {
        const savedMatch = productReferences.find((item) => {
          const needle = normalizeItemNumber(item.itemNumber);
          return [
            text(candidate.data.sku),
            text(candidate.data.manufacturerItemId),
            text(candidate.data.model),
            text(candidate.data.upc),
            text(candidate.data.barcode),
            text(candidate.data.name),
            text(candidate.data.searchText),
          ]
            .map(normalizeItemNumber)
            .some((value) => value === needle || value.includes(needle));
        });

        return savedMatch ?? findBuiltinProductReference(candidate.data);
      })();

      if (reference) {
        const referenceFields = buildReferenceFields(reference);

        for (const field of candidate.blankFields) {
          const sourceValue = referenceFields[field];
          if (!sourceValue) continue;

          updates[field] = sourceValue;
          filledFields.push({
            field,
            currentValue: null,
            sourceValue,
            confidence: 98,
            sourceDocId: reference.itemNumber,
            sourceCollection: "jarvisProductReferences",
          });
        }
      }

      const name = text(candidate.data.name);
      const sku = text(candidate.data.sku);
      const upc = text(candidate.data.upc);
      const manufacturer = text(candidate.data.manufacturer);
      const category = text(candidate.data.category);

      const searchIdentifiers = (() => {
        const identifiers: string[] = [];
        if (name) identifiers.push(name.toLowerCase());
        if (sku) identifiers.push(sku.toLowerCase());
        if (upc) identifiers.push(upc.toLowerCase());
        if (manufacturer) identifiers.push(manufacturer.toLowerCase());
        if (category) identifiers.push(category.toLowerCase());
        return identifiers;
      })();

      if (!searchIdentifiers.length && !reference) {
        continue;
      }

      const siblingChecks: Array<{ field: string; value: string }> = [];
      if (sku) siblingChecks.push({ field: "sku", value: sku });
      if (upc) siblingChecks.push({ field: "upc", value: upc });
      if (manufacturer) siblingChecks.push({ field: "manufacturer", value: manufacturer });
      if (category) siblingChecks.push({ field: "category", value: category });

      let matchedSibling: AutoFillRecord | null = null;
      let matchConfidence = 0;
      let matchDocId = "";

      for (const check of siblingChecks) {
        const siblingSnap = await collectionRef
          .where(check.field, "==", check.value)
          .limit(5)
          .get();

        const siblings = siblingSnap.docs.filter((docSnap) => docSnap.id !== candidate.docId);

        if (siblings.length > 0 && matchConfidence < 85) {
          matchedSibling = siblings[0].data();
          matchDocId = siblings[0].id;
          matchConfidence = 85;
        }
      }

      if (!matchedSibling && name && name.length > 2) {
        const nameSnap = await collectionRef
          .where("name", "==", name)
          .limit(5)
          .get();

        const nameMatches = nameSnap.docs.filter((docSnap) => docSnap.id !== candidate.docId);

        if (nameMatches.length > 0 && matchConfidence < 95) {
          matchedSibling = nameMatches[0].data();
          matchDocId = nameMatches[0].id;
          matchConfidence = 95;
        }
      }

      if (!matchedSibling && manufacturer && manufacturer.length > 2) {
        const mfgSnap = await collectionRef
          .where("manufacturer", "==", manufacturer)
          .limit(10)
          .get();

        const mfgMatches = mfgSnap.docs.filter((docSnap) => docSnap.id !== candidate.docId);

        if (mfgMatches.length > 0 && matchConfidence < 70) {
          matchedSibling = mfgMatches[0].data();
          matchDocId = mfgMatches[0].id;
          matchConfidence = 70;
        }
      }

      if ((!matchedSibling || !Object.keys(matchedSibling).length) && !Object.keys(updates).length) {
        continue;
      }

      if (matchedSibling) {
        for (const field of candidate.blankFields.filter((field) => updates[field] === undefined)) {
          const siblingValue = matchedSibling[field];
          const normalizedSibling = text(siblingValue);

          if (normalizedSibling) {
            updates[field] = normalizedSibling;
            filledFields.push({
              field,
              currentValue: null,
              sourceValue: normalizedSibling,
              confidence: matchConfidence,
              sourceDocId: matchDocId,
              sourceCollection: collectionName,
            });
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await collectionRef.doc(candidate.docId).update({
          ...updates,
          updatedAt: AdminFieldValue.serverTimestamp(),
          updatedByEmail: actor,
          autoFilledBy: "jarvis",
          autoFillTimestamp: AdminFieldValue.serverTimestamp(),
          autoFillConfidence: matchConfidence,
        });

        if (collectionName === "inventory") {
          const productId = text(candidate.data.productId);
          if (productId) {
            await adminDb.collection("products").doc(productId).update({
              ...Object.fromEntries(
                Object.entries(updates).filter(([key]) => ["name", "manufacturer", "manufacturerItemId", "model", "sku", "upc", "hcpcs", "category"].includes(key))
              ),
              updatedAt: AdminFieldValue.serverTimestamp(),
              updatedByEmail: actor,
              autoFilledBy: "jarvis",
              autoFillTimestamp: AdminFieldValue.serverTimestamp(),
              autoFillConfidence: matchConfidence,
            });
          }
        }

        await adminDb.collection("jarvisAutoFillLog").add({
          docId: candidate.docId,
          collection: collectionName,
          filledFields: filledFields.map((item) => ({
            field: item.field,
            sourceValue: item.sourceValue,
            confidence: item.confidence,
            sourceDocId: item.sourceDocId,
          })),
          confidence: matchConfidence,
          createdByEmail: actor,
          createdAt: AdminFieldValue.serverTimestamp(),
        });
      }

      if (filledFields.length > 0) {
        results.push({
          docId: candidate.docId,
          collection: collectionName,
          filledFields,
        });
      }
    }
  }

  return results;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission(request, "inventory:write");
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as Record<string, unknown>;
  const mode = text(body.mode);
  const actor = auth.email ?? auth.uid;

  if (mode === "identifyInventory") {
    return enrichInventory(body, actor);
  }

  if (mode === "enrichProductImages") {
    return enrichProductImages(body, actor);
  }

  if (mode === "identifySku") {
    const sku = text(body.sku);
    if (!sku) {
      return NextResponse.json({ error: "sku is required" }, { status: 400 });
    }

    const vendorResearchSites = await loadVendorResearchSites();
    const preferredDomains = vendorResearchSites.map(domainFromRecord);

    const guess = await identifySku(sku, preferredDomains);

    if (!guess) {
      return NextResponse.json({ error: "Jarvis could not identify a likely product from that SKU." }, { status: 404 });
    }

    return NextResponse.json({ guess });
  }

  if (mode === "autoFillBlankFields") {
    const collections = Array.isArray(body.collections)
      ? body.collections.map(text).filter(Boolean)
      : ["inventory", "products"];

    const results = await autoFillBlankFields(collections, actor);
    return NextResponse.json({ results });
  }

  return NextResponse.json({ error: "Unsupported enrichment mode" }, { status: 400 });
}
