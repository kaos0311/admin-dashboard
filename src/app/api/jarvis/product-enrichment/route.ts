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

function canonicalDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "");
}

function domainMatchesPreferred(domain: string, preferredDomain: string): boolean {
  const current = canonicalDomain(domain);
  const preferred = canonicalDomain(preferredDomain);
  return current === preferred || current.endsWith(`.${preferred}`);
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
    if (
      domain &&
      Array.from(preferred).some((preferredDomain) =>
        domainMatchesPreferred(domain, preferredDomain)
      )
    ) {
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

function uniqueResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = result.url || `${result.title}:${result.snippet}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function webSearchVendorFirst(
  query: string,
  preferredDomains: string[] = []
): Promise<SearchResult[]> {
  const cleanDomains = Array.from(
    new Set(
      preferredDomains
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const sourceResults: SearchResult[] = [];
  for (const domain of cleanDomains.slice(0, 6)) {
    const results = await webSearch(`site:${domain} ${query}`, cleanDomains);
    sourceResults.push(...results.slice(0, 3));
  }

  const broadResults = await webSearch(query, cleanDomains);
  return rankSearchResults(uniqueResults([...sourceResults, ...broadResults]), cleanDomains);
}

async function identifySku(
  sku: string,
  preferredDomains: string[] = []
): Promise<ProductGuess | null> {
  const barcodeGuess = await lookupBarcodeProduct(sku);
  if (barcodeGuess) return barcodeGuess;

  const query = [
    sku,
    "home medical equipment product",
  ].join(" ");
  const results = await webSearchVendorFirst(query, preferredDomains);
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

function looksLikeProductBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(value.trim());
}

function readFirstString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = readFirstString(item);
      if (normalized) return normalized;
    }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return readFirstString(record.url || record.link || record.src);
  }
  return "";
}

function pickBarcodeProductPayload(data: unknown): BarcodeLookupProduct | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const directProduct = record.product;
  if (directProduct && typeof directProduct === "object") {
    return directProduct as BarcodeLookupProduct;
  }

  const products = record.products;
  if (Array.isArray(products) && products[0] && typeof products[0] === "object") {
    return products[0] as BarcodeLookupProduct;
  }

  return record as BarcodeLookupProduct;
}

async function lookupBarcodeProduct(barcode: string): Promise<ProductGuess | null> {
  const cleanBarcode = normalizeBarcode(barcode);
  const apiKey = text(process.env.RAPIDAPI_KEY);
  if (!looksLikeProductBarcode(cleanBarcode) || !apiKey) return null;

  try {
    const response = await fetch(
      `https://barcode-lookup.p.rapidapi.com/v3/products?barcode=${encodeURIComponent(cleanBarcode)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-host": "barcode-lookup.p.rapidapi.com",
          "x-rapidapi-key": apiKey,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) return null;

    const product = pickBarcodeProductPayload(await response.json());
    if (!product) return null;

    const name = text(product.title) || text(product.name) || text(product.description);
    if (!name) return null;

    const imageUrl = await processProductImageUrl(
      readFirstString(product.images) || readFirstString(product.image)
    );

    return {
      name,
      category: text(product.category) || inferCategory(name),
      manufacturer: text(product.brand) || text(product.manufacturer),
      model: text(product.model) || text(product.mpn),
      sku: text(product.mpn),
      upc: text(product.barcode) || cleanBarcode,
      hcpcs: "",
      imageUrl,
      sourceUrl: `https://barcode-lookup.p.rapidapi.com/v3/products?barcode=${encodeURIComponent(cleanBarcode)}`,
      confidence: 0.85,
      warrantyMonths: 0,
    };
  } catch {
    return null;
  }
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

async function processProductImageUrl(imageUrl: string): Promise<string> {
  const apiKey = text(process.env.CHANGE_PHOTOS_API_KEY);
  if (!imageUrl || !apiKey) return imageUrl;

  try {
    const response = await fetch("https://change.photos/api/change", {
      method: "POST",
      headers: {
        "X-Api-Key": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: imageUrl,
        width: 800,
        height: 800,
        fit: "inside",
        compress: true,
        format: "webp",
      }),
      cache: "no-store",
    });

    if (!response.ok) return imageUrl;

    const data = (await response.json()) as { url?: unknown };
    const processedUrl = text(data.url);
    return processedUrl || imageUrl;
  } catch {
    return imageUrl;
  }
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
      if (image && image.startsWith("http")) return processProductImageUrl(image);
      if (image && image.startsWith("/")) {
        const base = new URL(result.url);
        return processProductImageUrl(`${base.origin}${image}`);
      }
    } catch {
      continue;
    }
  }

  return "";
}

async function identifyProduct(
  queryParts: string[],
  preferredDomains: string[] = []
): Promise<ProductGuess | null> {
  for (const part of queryParts) {
    const barcodeGuess = await lookupBarcodeProduct(part);
    if (barcodeGuess) return barcodeGuess;
  }

  const strongIdentifiers = queryParts
    .map((part) => part.trim())
    .filter((part) => /^[A-Z0-9-]{6,}$/i.test(part));
  const query = [
    ...queryParts.filter(Boolean),
    "home medical equipment product",
  ].join(" ");
  const results = await webSearchVendorFirst(query, preferredDomains);
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


