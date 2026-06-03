import { colors } from "./colors";

const base =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

const compactBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export const buttons = {
  base,

  primary:
    [
      base,
      "bg-cyan-600 text-white hover:bg-cyan-500",
    ].join(" "),

  secondary:
    [
      base,
      colors.border,
      colors.surface,
      colors.textPrimary,
      colors.surfaceHover,
    ].join(" "),

  danger:
    [
      base,
      "bg-rose-600 text-white hover:bg-rose-500",
    ].join(" "),

  warning:
    [
      base,
      "bg-amber-500 text-slate-950 hover:bg-amber-400",
    ].join(" "),

  success:
    [
      base,
      "bg-emerald-600 text-white hover:bg-emerald-500",
    ].join(" "),

  info:
    [
      base,
      "bg-sky-600 text-white hover:bg-sky-500",
    ].join(" "),

  ghost:
    [
      base,
      colors.border,
      "bg-transparent",
      colors.textSecondary,
      "hover:bg-white/[0.06] hover:text-white",
    ].join(" "),

  subtle:
    [
      base,
      colors.border,
      colors.surfaceStrong,
      colors.textSecondary,
      "hover:bg-white/[0.09] hover:text-white",
    ].join(" "),

  compact: compactBase,

  compactPrimary:
    [
      compactBase,
      "bg-cyan-600 text-white hover:bg-cyan-500",
    ].join(" "),

  compactSecondary:
    [
      compactBase,
      colors.border,
      colors.surface,
      colors.textPrimary,
      colors.surfaceHover,
    ].join(" "),

  compactDanger:
    [
      compactBase,
      "bg-rose-600 text-white hover:bg-rose-500",
    ].join(" "),

  compactWarning:
    [
      compactBase,
      "bg-amber-500 text-slate-950 hover:bg-amber-400",
    ].join(" "),

  compactSuccess:
    [
      compactBase,
      "bg-emerald-600 text-white hover:bg-emerald-500",
    ].join(" "),

  icon:
    [
      "inline-flex h-10 w-10 items-center justify-center rounded-2xl transition disabled:cursor-not-allowed disabled:opacity-50",
      colors.border,
      colors.surface,
      colors.textSecondary,
      colors.surfaceHover,
    ].join(" "),

  iconDanger:
    [
      "inline-flex h-10 w-10 items-center justify-center rounded-2xl transition disabled:cursor-not-allowed disabled:opacity-50",
      colors.dangerBadge,
    ].join(" "),

  iconSuccess:
    [
      "inline-flex h-10 w-10 items-center justify-center rounded-2xl transition disabled:cursor-not-allowed disabled:opacity-50",
      colors.successBadge,
    ].join(" "),

  iconWarning:
    [
      "inline-flex h-10 w-10 items-center justify-center rounded-2xl transition disabled:cursor-not-allowed disabled:opacity-50",
      colors.warningBadge,
    ].join(" "),

  iconArchive:
    [
      "inline-flex h-10 w-10 items-center justify-center rounded-2xl transition disabled:cursor-not-allowed disabled:opacity-50",
      colors.dangerBadge,
    ].join(" "),

  iconDelete:
    [
      "inline-flex h-10 w-10 items-center justify-center rounded-2xl transition disabled:cursor-not-allowed disabled:opacity-50",
      colors.dangerBadge,
    ].join(" "),
  iconInline:
    [
      "absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 transition disabled:cursor-not-allowed disabled:opacity-60",
      colors.textSecondary,
      "hover:bg-white/10 hover:text-white",
    ].join(" "),

  fullPrimary:
    [
      base,
      "w-full py-3",
      "bg-white text-black hover:bg-zinc-200",
    ].join(" "),

} as const;

export type ButtonKey = keyof typeof buttons;



