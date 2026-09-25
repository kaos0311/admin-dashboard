export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type ProductGuess = {
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

export type BarcodeLookupProduct = {
  title?: unknown;
  name?: unknown;
  description?: unknown;
  category?: unknown;
  brand?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  mpn?: unknown;
  barcode?: unknown;
  images?: unknown;
  image?: unknown;
};


export type VendorResearchSite = {
  id: string;
  name: string;
  url: string;
};
