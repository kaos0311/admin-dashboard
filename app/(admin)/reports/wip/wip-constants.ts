import type { WipStatus } from "./wip-types";

export const STATUS_LABELS: Record<WipStatus, string> = {
  open: "Open",
  pending: "Pending",
  completed: "Completed",
  cancelled: "Cancelled",
  unknown: "Unknown",
};

export const STATUS_BADGE_CLASSES: Record<WipStatus, string> = {
  open: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  completed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  cancelled: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  unknown: "border-slate-400/30 bg-slate-400/10 text-slate-200",
};

export const AGING_LABELS: Record<string, string> = {
  "0-7": "0-7 days",
  "8-14": "8-14 days",
  "15-30": "15-30 days",
  "31-60": "31-60 days",
  "61-90": "61-90 days",
  "90+": "90+ days",
};

export const EMPTY_VALUE = "â€”";

export const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};


