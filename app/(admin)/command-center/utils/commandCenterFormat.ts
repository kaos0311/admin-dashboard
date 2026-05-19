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
      return "border-red-500/40 bg-red-500/10 text-red-200";

    case "high":
      return "border-orange-500/40 bg-orange-500/10 text-orange-200";

    case "medium":
    case "in_progress":
      return "border-yellow-500/40 bg-yellow-500/10 text-yellow-200";

    case "low":
    case "open":
      return "border-blue-500/40 bg-blue-500/10 text-blue-200";

    case "resolved":
    case "completed":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";

    default:
      return "border-white/10 bg-white/5 text-neutral-300";
  }
}