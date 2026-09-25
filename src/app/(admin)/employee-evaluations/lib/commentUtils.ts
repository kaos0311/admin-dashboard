import { badges } from "@/theme";

import type { CommentTone, EmployeeEvaluationComment } from "../types";

export function formatDateLabel(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }
  return "";
}

export const TONE_OPTIONS: { value: CommentTone; label: string }[] = [
  { value: "positive", label: "Positive" },
  { value: "corrective", label: "Corrective" },
  { value: "neutral", label: "Neutral" },
];

export const TONE_BADGE: Record<CommentTone, string> = {
  positive: badges.active,
  corrective: badges.warning,
  neutral: badges.info,
};

export const TONE_LABEL: Record<CommentTone, string> = {
  positive: "Positive",
  corrective: "Corrective",
  neutral: "Neutral",
};

function textValue(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeCommentDoc(
  docSnap: { id: string; data: () => Record<string, unknown> }
): EmployeeEvaluationComment {
  const data = docSnap.data();
  const tone: CommentTone =
    data.tone === "positive" || data.tone === "corrective"
      ? data.tone
      : "neutral";

  return {
    id: docSnap.id,
    employeeId: textValue(data.employeeId),
    employeeName: textValue(data.employeeName),
    tone,
    comment: textValue(data.comment),
    createdAtLabel: formatDateLabel(data.createdAt),
    createdByEmail: textValue(data.createdByEmail),
  };
}
