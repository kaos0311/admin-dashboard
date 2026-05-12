export function normalizeBarcode(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

export function safeLower(value: string | undefined | null): string {
  return (value ?? "").toLowerCase().trim();
}