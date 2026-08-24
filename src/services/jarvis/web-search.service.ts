import { adminDb } from "@/lib/firebaseAdmin";
import type { SearchResult } from "@/services/jarvis/product-enrichment-types";

type VendorResearchSite = {
  id: string;
  name: string;
  url: string;
};

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

function canonicalDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "");
}

function domainMatchesPreferred(domain: string, preferredDomain: string): boolean {
  const current = canonicalDomain(domain);
  const preferred = canonicalDomain(preferredDomain);
  return current === preferred || current.endsWith("." + preferred);
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

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
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
  const url = "https://duckduckgo.com/html/?q=" + encodeURIComponent(query);
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
    const key = result.url || (result.title + ":" + result.snippet);
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
    const results = await webSearch("site:" + domain + " " + query, cleanDomains);
    sourceResults.push(...results.slice(0, 3));
  }

  const broadResults = await webSearch(query, cleanDomains);
  return rankSearchResults(uniqueResults([...sourceResults, ...broadResults]), cleanDomains);
}

export {
  type SearchResult,
  type VendorResearchSite,
  loadVendorResearchSites,
  extractDomain,
  extractDuckResults,
  webSearch,
  webSearchVendorFirst,
  decodeHtml,
};
