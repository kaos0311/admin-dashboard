export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function buildSearchTokens(value: string): string[] {
  return Array.from(
    new Set(normalizeSearchText(value).split(" ").filter(Boolean))
  ).slice(0, 75);
}