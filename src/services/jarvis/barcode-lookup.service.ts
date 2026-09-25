import type {
  BarcodeLookupProduct,
  ProductGuess,
} from "@/services/jarvis/product-enrichment-types";
import { normalizeBarcode } from "@/lib/barcode";
import { processProductImageUrl } from "@/services/jarvis/product-image.service";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function inferCategory(value: string): string {
  const normalized = value.toLowerCase();

  if (normalized.includes("cpap") || normalized.includes("bipap")) return "Respiratory";
  if (normalized.includes("oxygen") || normalized.includes("concentrator")) return "Oxygen";
  if (normalized.includes("wheelchair")) return "Mobility";
  if (normalized.includes("walker") || normalized.includes("rollator")) return "Mobility";
  if (normalized.includes("hospital bed") || normalized.includes("bed")) return "Beds";
  if (normalized.includes("commode")) return "Bath Safety";

  return "Medical Equipment";
}


export function looksLikeProductBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(value.trim());
}

export function readFirstString(value: unknown): string {
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

export function pickBarcodeProductPayload(data: unknown): BarcodeLookupProduct | null {
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

export async function lookupBarcodeProduct(barcode: string): Promise<ProductGuess | null> {
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


