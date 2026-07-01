import { badges } from "@/theme";

import type { WipStatus } from "./wip-types";

export const STATUS_LABELS: Record<WipStatus, string> = {
  open: "Open",
  pending: "Pending",
  completed: "Completed",
  cancelled: "Cancelled",
  unknown: "Unknown",
};

export const STATUS_BADGE_CLASSES: Record<WipStatus, string> = {
  open: badges.info,
  pending: badges.neutral,
  completed: badges.success,
  cancelled: badges.danger,
  unknown: badges.neutral,
};

export const AGING_LABELS: Record<string, string> = {
  "0-7": "0-7 days",
  "8-14": "8-14 days",
  "15-30": "15-30 days",
  "31-60": "31-60 days",
  "61-90": "61-90 days",
  "90+": "90+ days",
};

export const EMPTY_VALUE = "-";

export const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};
