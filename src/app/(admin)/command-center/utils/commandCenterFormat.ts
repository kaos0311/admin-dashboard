import { actionButtonClass, badges } from "@/theme";

export function formatIssueType(value?: string) {
  if (!value) return "Unknown Issue";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function badgeClass(value?: string) {
  switch (value) {
    case "critical":
    case "urgent":
    case "blocked":
      return badges.danger;

    case "high":
      return badges.warning;

    case "medium":
    case "in_progress":
      return badges.warning;

    case "low":
    case "open":
      return badges.info;

    case "resolved":
    case "completed":
      return badges.success;

    default:
      return badges.neutral;
  }
}

export function alertButtonClass(value?: string) {
  return actionButtonClass(value);
}
