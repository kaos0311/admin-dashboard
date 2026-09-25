import type { SearchResult } from "@/services/jarvis/product-enrichment-types";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function extractMetaImage(html: string): string {
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

export async function processProductImageUrl(imageUrl: string): Promise<string> {
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

export async function findImageUrl(results: SearchResult[]): Promise<string> {
  for (const result of results.slice(0, 5)) {
    try {
      const response = await fetch(result.url, {
        headers: { "user-agent": "Mozilla/5.0 JarvisProductEnrichment/1.0" },
        cache: "no-store",
      });

      if (!response.ok) continue;

      const image = extractMetaImage(await response.text());

      if (image && image.startsWith("http")) {
        return processProductImageUrl(image);
      }

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
