import type { ProductGuess } from "@/services/jarvis/product-enrichment-types";
import { lookupBarcodeProduct } from "@/services/jarvis/barcode-lookup.service";
import { findImageUrl } from "@/services/jarvis/product-image.service";
import { webSearchVendorFirst } from "@/services/jarvis/web-search.service";

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

  const match = known.find((brand) =>
    value.toLowerCase().includes(brand.toLowerCase())
  );

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

export async function identifySku(
  sku: string,
  preferredDomains: string[] = []
): Promise<ProductGuess | null> {
  const barcodeGuess = await lookupBarcodeProduct(sku);
  if (barcodeGuess) return barcodeGuess;

  const query = [sku, "home medical equipment product"].join(" ");
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

export async function identifyProduct(
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
