import type { Timestamp } from "firebase/firestore";

export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[Unable to display details]";
  }
}

export function humanAction(action: string): string {
  return action.replaceAll("_", " ");
}

export function formatTimestamp(value: Timestamp | null): string {
  if (!value) return "—";

  try {
    return value.toDate().toLocaleString();
  } catch {
    return "—";
  }
}

export function sanitizeCsvCell(value: unknown): string {
  const text = String(value ?? "");
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;

  return `"${guarded.replaceAll('"', '""')}"`;
}