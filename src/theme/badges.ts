/**
 * @deprecated Import badge styles from `@/theme/colors` directly.
 *   - colors.successBadge instead of badges.success
 *   - colors.warningBadge instead of badges.warning
 *   - colors.dangerBadge   instead of badges.danger
 *   - colors.infoBadge     instead of badges.info
 *   - colors.neutral       instead of badges.neutral
 *   - colors.pulse         instead of badges.pulseDot
 *
 * This file is a backward-compatibility bridge and will be removed.
 */
import { colors } from "./colors";
import { surfaces } from "./surfaces";

export const badges = {
  success: colors.successBadge,
  warning: colors.warningBadge,
  danger: colors.dangerBadge,
  info: `inline-flex items-center gap-2 rounded-full px-3 py-1 ${colors.infoBadge} shadow-inner whitespace-nowrap`,
  neutral: colors.neutral,
  active: colors.activeBadge,

  kpiCard: {
    neutral: "border-[#3a3a3a] bg-[#1c1c1c] text-[#ececec]",
    cyan: surfaces.alertInfo,
    red: surfaces.alertDanger,
    emerald: surfaces.alertSuccess,
    yellow: surfaces.alertWarning,
  },

  kpiIcon: {
    neutral: "border-[#3a3a3a] bg-[#222222] text-[#888888]",
    cyan: `${colors.infoBadge} border-[#7a9a5e]/25`,
    red: `${colors.dangerBadge} border-[#b84a4a]/25`,
    emerald: `${colors.successBadge} border-[#6a9a6a]/25`,
    yellow: `${colors.warningBadge} border-[#c49a4a]/25`,
  },

  pulseDot: colors.pulse,
} as const;

export type BadgeKey = keyof typeof badges;
