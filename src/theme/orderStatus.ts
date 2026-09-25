/**
 * @deprecated Import status styles from `@/theme/colors` directly.
 *   - colors.infoBadge     instead of orderStatusStyles.processing
 *   - colors.successBadge  instead of orderStatusStyles.delivered
 *   - colors.dangerBadge   instead of orderStatusStyles.cancelled
 *   - colors.neutral       instead of orderStatusStyles.archived
 *
 * This file is a backward-compatibility bridge and will be removed.
 */
import { colors } from "./colors";

export const orderStatusStyles = {
  processing: colors.infoBadge,
  ready: colors.activeBadge,
  delivered: colors.successBadge,
  cancelled: colors.dangerBadge,
  archived: colors.neutral,
} as const;

export const orderStatusLabels = {
  processing: "Processing",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
  archived: "Archived",
} as const;
