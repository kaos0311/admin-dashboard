export function safeFirestoreId(value: unknown): string {
  const cleaned = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "unknown";
}

export function safeText(value: unknown): string {
  return String(value ?? "").trim();
}

export function safeLowerText(value: unknown): string {
  return safeText(value).toLowerCase();
}

export function safeMoney(value: unknown): number {
  const parsed = Number(
    String(value ?? "")
      .replace(/[$,]/g, "")
      .trim()
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

export function safeDateIso(value: unknown): string | null {
  const raw = safeText(value);

  if (!raw) return null;

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}