import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

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

async function webSearch(query: string): Promise<SearchResult[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 JarvisProductEnrichment/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) return [];
  return extractDuckResults(await response.text());
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

async function identifyProduct(queryParts: string[]): Promise<ProductGuess | null> {
  const strongIdentifiers = queryParts
    .map((part) => part.trim())
    .filter((part) => /^[A-Z0-9-]{6,}$/i.test(part));
  const query = [
    ...queryParts.filter(Boolean),
    "home medical equipment product",
  ].join(" ");
  const results = await webSearch(query);
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
    model: "",
    sku: "",
    upc: "",
    hcpcs: "",
    imageUrl,
    sourceUrl: best.url,
    confidence: name ? 0.55 : 0.35,
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
  const guess = await identifyProduct([
    code,
    text(current.name).replace(/^Pending scanned item\s+/i, ""),
    text(current.manufacturer),
    text(current.modelNumber),
  ]);

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
      jarvisWebEnrichedAt: FieldValue.serverTimestamp(),
      jarvisWebEnrichment: {
        sourceUrl: guess.sourceUrl,
        imageUrl: guess.imageUrl,
        confidence: guess.confidence,
        queryCode: code,
      },
      updatedAt: FieldValue.serverTimestamp(),
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
        enrichedAt: FieldValue.serverTimestamp(),
      },
      searchText: normalizeSearchText(inventorySearchValues.join(" ")),
      updatedAt: FieldValue.serverTimestamp(),
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

  const updated: Array<{ productId: string; imageUrl: string; sourceUrl: string }> = [];

  for (const productId of ids) {
    const ref = adminDb.collection("products").doc(productId);
    const snap = await ref.get();
    if (!snap.exists) continue;

    const product = snap.data() ?? {};
    if (text(product.imageUrl) && text(product.thumbnailUrl)) continue;

    const guess = await identifyProduct([
      text(product.name),
      text(product.manufacturer),
      text(product.model),
      text(product.sku),
      text(product.upc),
      "stock product image",
    ]);

    if (!guess?.imageUrl) continue;

    await ref.set(
      {
        imageUrl: text(product.imageUrl) || guess.imageUrl,
        thumbnailUrl: text(product.thumbnailUrl) || guess.imageUrl,
        jarvisImageEnrichment: {
          sourceUrl: guess.sourceUrl,
          imageUrl: guess.imageUrl,
          confidence: guess.confidence,
          enrichedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
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

  return NextResponse.json({ error: "Unsupported enrichment mode" }, { status: 400 });
}
