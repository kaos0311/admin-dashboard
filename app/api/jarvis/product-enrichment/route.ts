import { NextRequest, NextResponse } from "next/server";
import { FieldValue as AdminFieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { normalizeBarcode } from "@/lib/barcode";

export const runtime = "nodejs";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type ProductGuess = {
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  sku: string;
  upc: string;
  hcpcs: string;
  imageUrl: string;
  sourceUrl: string;
  confidence: number;
  warrantyMonths: number;
};

type VendorResearchSite = {
  id: string;
  name: string;
  url: string;
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

function normalizeVendorSite(
  id: string,
  data: Record<string, unknown>
): VendorResearchSite {
  const url = typeof data.url === "string" ? data.url.trim() : "";
  return { id, name: typeof data.name === "string" ? data.name.trim() : id, url };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function domainFromRecord(record: { url?: string }): string {
  const url = typeof record.url === "string" ? record.url : "";
  return extractDomain(url);
}

function rankSearchResults(
  results: SearchResult[],
  preferredDomains: string[]
): SearchResult[] {
  if (!preferredDomains.length || !results.length) return results;

  const preferred = new Set(
    preferredDomains
      .map((domain) => domain.toLowerCase())
      .filter((domain) => domain.length > 0)
  );

  const preferredResults: SearchResult[] = [];
  const otherResults: SearchResult[] = [];

  for (const result of results) {
    const domain = extractDomain(result.url);
    if (domain && preferred.has(domain)) {
      preferredResults.push(result);
    } else {
      otherResults.push(result);
    }
  }

  return [...preferredResults, ...otherResults];
}

async function loadVendorResearchSites(): Promise<VendorResearchSite[]> {
  try {
    const snapshot = await adminDb
      .collection("vendorResearchSites")
      .limit(200)
      .get();

    return snapshot.docs.map((docSnap) => normalizeVendorSite(docSnap.id, docSnap.data()));
  } catch {
    return [];
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function cleanTitle(value: string): string {
  return value
    .replace(/\s+[-|]\s+(Amazon|Walmart|eBay|Google Shopping|Shop|Store).*$/i, "")
    .replace(/\bNew\b|\bBuy\b|\bSale\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferCategory(value: string): string {
  const haystack = value.toLowerCase();
  if (haystack.includes("cpap") || haystack.includes("bipap") || haystack.includes("mask")) return "CPAP";
  if (haystack.includes("oxygen") || haystack.includes("concentrator")) return "Oxygen";
  if (haystack.includes("wheelchair")) return "Mobility";
  if (haystack.includes("walker") || haystack.includes("rollator")) return "Mobility";
  if (haystack.includes("hospital bed") || haystack.includes("bed rail")) return "Beds";
  if (haystack.includes("commode") || haystack.includes("bath")) return "Bath Safety";
  return "Pending Web Review";
}

function guessManufacturer(value: string): string {
  const known = [
    "ResMed",
    "Philips",
    "Respironics",
    "Drive",
    "Invacare",
    "Medline",
    "Fisher & Paykel",
    "Sunrise",
    "Pride",
    "Golden",
    "DeVilbiss",
  ];
  const match = known.find((brand) => value.toLowerCase().includes(brand.toLowerCase()));
  return match ?? "";
}

function extractWarrantyMonths(value: string): number {
  const text = value.toLowerCase();

  const yearMatch = /\b(\d+)\s*-?\s*year\b/.exec(text);
  if (yearMatch) {
    const years = Number(yearMatch[1]);
    if (Number.isFinite(years)) {
      return Math.round(years * 12);
    }
  }

  const monthMatch = /\b(\d+)\s*-?\s*month\b/.exec(text);
  if (monthMatch) {
    const months = Number(monthMatch[1]);
    if (Number.isFinite(months)) {
      return months;
    }
  }

  return 0;
}

function extractModelNumber(value: string): string {
  const match = /(?:model|part)[\s:#-]*([A-Z0-9][A-Z0-9\-\._\/]{2,})/i.exec(value);
  if (!match) return "";
  return match[1].replace(/[\s]+/g, " ").trim();
}

function extractDuckResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const resultPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = resultPattern.exec(html)) && results.length < 8) {
    let url = decodeHtml(match[1] ?? "");
    const uddg = /uddg=([^&]+)/.exec(url);
    if (uddg) {
      try {
        url = decodeURIComponent(uddg[1]);
      } catch {
        url = decodeHtml(match[1] ?? "");
      }
    }

    results.push({
      title: stripTags(match[2] ?? ""),
      url,
      snippet: stripTags(match[3] ?? ""),
    });
  }

  return results;
}

async function webSearch(query: string, preferredDomains: string[] = []): Promise<SearchResult[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 JarvisProductEnrichment/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) return [];
  const results = extractDuckResults(await response.text());
  return rankSearchResults(results, preferredDomains);
}

async function identifySku(
  sku: string,
  preferredDomains: string[] = [],
  preferredSiteNames: string[] = []
): Promise<ProductGuess | null> {
  const query = [
    sku,
    "home medical equipment product",
  ].join(" ");
  const baseResults = await webSearch(query, preferredDomains);
  const results =
    preferredSiteNames.length && baseResults.length
      ? rankSearchResults(
          baseResults,
          preferredSiteNames
            .map((name) => name.trim())
            .filter((name) => name.length > 0)
        )
      : baseResults;
  const best = results[0];

  if (!best) return null;

  const combined = `${best.title} ${best.snippet}`;
  const name = cleanTitle(best.title) || cleanTitle(best.snippet);
  const imageUrl = await findImageUrl(results);

  return {
    name: name || sku,
    category: inferCategory(combined),
    manufacturer: guessManufacturer(combined),
    model: extractModelNumber(combined),
    sku,
    upc: "",
    hcpcs: "",
    imageUrl,
    sourceUrl: best.url,
    confidence: name ? 0.6 : 0.35,
    warrantyMonths: extractWarrantyMonths(combined),
  };
}

function extractMetaImage(html: string): string {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return decodeHtml(match[1]);
  }

  return "";
}

async function findImageUrl(results: SearchResult[]): Promise<string> {
  for (const result of results.slice(0, 5)) {
    try {
      const response = await fetch(result.url, {
        headers: { "user-agent": "Mozilla/5.0 JarvisProductEnrichment/1.0" },
        cache: "no-store",
      });
      if (!response.ok) continue;
      const image = extractMetaImage(await response.text());
      if (image && image.startsWith("http")) return image;
      if (image && image.startsWith("/")) {
        const base = new URL(result.url);
        return `${base.origin}${image}`;
      }
    } catch {
      continue;
    }
  }

  return "";
}

async function identifyProduct(
  queryParts: string[],
  preferredDomains: string[] = [],
  preferredSiteNames: string[] = []
): Promise<ProductGuess | null> {
  const strongIdentifiers = queryParts
    .map((part) => part.trim())
    .filter((part) => /^[A-Z0-9-]{6,}$/i.test(part));
  const query = [
    ...queryParts.filter(Boolean),
    "home medical equipment product",
  ].join(" ");
  const baseResults = await webSearch(query, preferredDomains);
  const results =
    preferredSiteNames.length && baseResults.length
      ? rankSearchResults(
          baseResults,
          preferredSiteNames
            .map((name) => name.trim())
            .filter((name) => name.length > 0)
        )
      : baseResults;
  const best = results[0];

  if (!best) return null;

  const combined = `${best.title} ${best.snippet}`;
  const combinedLower = combined.toLowerCase();
  const hasIdentifierMatch =
    strongIdentifiers.length === 0 ||
    strongIdentifiers.some((identifier) =>
      combinedLower.includes(identifier.toLowerCase())
    );

  if (!hasIdentifierMatch) {
    return null;
  }

  const name = cleanTitle(best.title) || cleanTitle(best.snippet);
  const imageUrl = await findImageUrl(results);

  return {
    name: name || queryParts.filter(Boolean).join(" "),
    category: inferCategory(combined),
    manufacturer: guessManufacturer(combined),
    model: extractModelNumber(combined),
    sku: queryParts.find((part) => /^[A-Z0-9-]{6,}$/i.test(part.trim()))?.trim() ?? "",
    upc: "",
    hcpcs: "",
    imageUrl,
    sourceUrl: best.url,
    confidence: name ? 0.55 : 0.35,
    warrantyMonths: extractWarrantyMonths(combined),
  };
}

async function requireUser(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;

  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
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
  const preferredSiteNames = vendorResearchSites.map((site) => site.name);

  const guess = await identifyProduct(
    [
      code,
      text(current.name).replace(/^Pending scanned item\s+/i, ""),
      text(current.manufacturer),
      text(current.modelNumber),
    ],
    preferredDomains,
    preferredSiteNames
  );

  if (!guess) {
    return NextResponse.json({ error: "Jarvis could not identify a likely product." }, { status: 404 });
  }

  const name = guess.name || text(current.name);
  const category = guess.category || text(current.category) || "Pending Web Review";
  const sku = text(current.sku);
  const serial = text(current.serial) || code;
  const upc = text(current.barcode);
  const productId = normalizeSearchText(sku || upc || `${name}-${category}`).replace(/\s+/g, "-");
  const searchValues = [
    name,
    category,
    guess.manufacturer,
    guess.model,
    sku,
    upc,
    guess.hcpcs,
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
      hcpcs: text(current.hcpc),
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
    text(current.hcpc),
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
  const preferredSiteNames = vendorResearchSites.map((site) => site.name);

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
      preferredDomains,
      preferredSiteNames
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

async function autoFillBlankFields(
  collections: string[],
  actor: string
): Promise<AutoFillResult[]> {
  const results: AutoFillResult[] = [];
  const BATCH_SIZE = 25;

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

      if (!searchIdentifiers.length) {
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

      if (!matchedSibling || !Object.keys(matchedSibling).length) {
        continue;
      }

      for (const field of candidate.blankFields) {
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
                Object.entries(updates).filter(([key]) => ["manufacturer", "manufacturerItemId", "model", "sku", "upc", "hcpcs", "category"].includes(key))
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
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const mode = text(body.mode);
  const actor = user.email ?? user.uid;

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
    const preferredSiteNames = vendorResearchSites.map((site) => site.name);

    const guess = await identifySku(sku, preferredDomains, preferredSiteNames);

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


