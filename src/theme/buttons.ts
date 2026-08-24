const sunkInShadow = "shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]";
const activeSunkIn = "active:translate-y-[1px] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]";

const focusRing = "focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#7a9a5e]/40";

const base =
  `inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${sunkInShadow} transition-all ${activeSunkIn} ${focusRing} disabled:cursor-not-allowed disabled:opacity-45`;

const compactBase =
  `inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${sunkInShadow} transition-all ${activeSunkIn} ${focusRing} disabled:cursor-not-allowed disabled:opacity-45`;

export const buttons = {
  base,

  primary:
    [
      base,
      "border-[#7a9a5e]/40 bg-[#5a7a3e] text-[#e6e6e6] hover:bg-[#6a8a4e] active:bg-[#4a6a2e]",
    ].join(" "),

  secondary:
    [
      base,
      "border-[#3a3a3a] bg-[#1c1c1c] text-[#e6e6e6] hover:bg-[#242424] active:bg-[#161616]",
    ].join(" "),

  upload:
    [
      base,
      "border-[#7a9a5e]/30 bg-[#4a6a3e] text-[#e6e6e6] hover:bg-[#5a7a4e] active:bg-[#3a5a2e]",
    ].join(" "),

  danger:
    [
      base,
      "border-[#b84a4a]/40 bg-[#8a2a2a] text-[#e6e6e6] hover:bg-[#9a3a3a] active:bg-[#6a1a1a]",
    ].join(" "),

  warning:
    [
      base,
      "border-[#c49a4a]/40 bg-[#9a7a2a] text-[#e6e6e6] hover:bg-[#aa8a3a] active:bg-[#7a5a1a]",
    ].join(" "),

  success:
    [
      base,
      "border-[#6a9a6a]/40 bg-[#4a7a4a] text-[#e6e6e6] hover:bg-[#5a8a5a] active:bg-[#3a5a3a]",
    ].join(" "),

  info:
    [
      base,
      "border-[#7a9a5e]/35 bg-[#2e423a] text-[#e6e6e6] hover:bg-[#3a524a] active:bg-[#24372e]",
    ].join(" "),

  ghost:
    [
      base,
      "border-transparent bg-transparent text-[#b8b8b8] hover:bg-[#1c1c1c] hover:text-[#e6e6e6] active:bg-[#161616]",
    ].join(" "),

  subtle:
    [
      base,
      "border-[#3a3a3a] bg-[#2a2a2a] text-[#b8b8b8] hover:bg-[#323232] hover:text-[#e6e6e6] active:bg-[#222222]",
    ].join(" "),

  compact: compactBase,

  compactPrimary:
    [
      compactBase,
      "border-[#7a9a5e]/40 bg-[#5a7a3e] text-[#e6e6e6] hover:bg-[#6a8a4e] active:bg-[#4a6a2e]",
    ].join(" "),

  compactSecondary:
    [
      compactBase,
      "border-[#3a3a3a] bg-[#1c1c1c] text-[#e6e6e6] hover:bg-[#242424] active:bg-[#161616]",
    ].join(" "),

  compactDanger:
    [
      compactBase,
      "border-[#b84a4a]/40 bg-[#8a2a2a] text-[#e6e6e6] hover:bg-[#9a3a3a] active:bg-[#6a1a1a]",
    ].join(" "),

  compactWarning:
    [
      compactBase,
      "border-[#c49a4a]/40 bg-[#9a7a2a] text-[#e6e6e6] hover:bg-[#aa8a3a] active:bg-[#7a5a1a]",
    ].join(" "),

  compactSuccess:
    [
      compactBase,
      "border-[#6a9a6a]/40 bg-[#4a7a4a] text-[#e6e6e6] hover:bg-[#5a8a5a] active:bg-[#3a5a3a]",
    ].join(" "),

  icon:
    [
      `inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#3a3a3a] bg-[#1c1c1c] text-[#b8b8b8] ${sunkInShadow} transition-all hover:bg-[#242424] ${activeSunkIn} ${focusRing} disabled:cursor-not-allowed disabled:opacity-45`,
    ].join(" "),

  iconDanger:
    [
      `inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#b84a4a]/30 bg-[#8a2a2a] text-[#e6e6e6] ${sunkInShadow} transition-all hover:bg-[#9a3a3a] ${activeSunkIn} ${focusRing} disabled:cursor-not-allowed disabled:opacity-45`,
    ].join(" "),

  iconSuccess:
    [
      `inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#6a9a6a]/30 bg-[#4a7a4a] text-[#e6e6e6] ${sunkInShadow} transition-all hover:bg-[#5a8a5a] ${activeSunkIn} ${focusRing} disabled:cursor-not-allowed disabled:opacity-45`,
    ].join(" "),

  iconWarning:
    [
      `inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#c49a4a]/30 bg-[#9a7a2a] text-[#e6e6e6] ${sunkInShadow} transition-all hover:bg-[#aa8a3a] ${activeSunkIn} ${focusRing} disabled:cursor-not-allowed disabled:opacity-45`,
    ].join(" "),

  iconArchive:
    [
      `inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#b84a4a]/30 bg-[#8a2a2a] text-[#e6e6e6] ${sunkInShadow} transition-all hover:bg-[#9a3a3a] ${activeSunkIn} ${focusRing} disabled:cursor-not-allowed disabled:opacity-45`,
    ].join(" "),

  iconDelete:
    [
      `inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#b84a4a]/30 bg-[#8a2a2a] text-[#e6e6e6] ${sunkInShadow} transition-all hover:bg-[#9a3a3a] ${activeSunkIn} ${focusRing} disabled:cursor-not-allowed disabled:opacity-45`,
    ].join(" "),

  iconInline:
    [
      `absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-[#3a3a3a] bg-[#1c1c1c] p-2 text-[#b8b8b8] ${sunkInShadow} transition-all hover:bg-[#242424] active:translate-y-[calc(-50%+1px)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] ${focusRing} disabled:cursor-not-allowed disabled:opacity-60`,
    ].join(" "),

  fullPrimary:
    [
      base,
      "w-full py-3 border-[#7a9a5e]/40 bg-[#5a7a3e] text-[#e6e6e6] hover:bg-[#6a8a4e] active:bg-[#4a6a2e]",
    ].join(" "),
} as const;

export type ButtonKey = keyof typeof buttons;

export type ActionTone =
  | "critical"
  | "urgent"
  | "blocked"
  | "danger"
  | "red"
  | "high"
  | "medium"
  | "watch"
  | "warning"
  | "orange"
  | "yellow"
  | "low"
  | "open"
  | "info"
  | "blue"
  | "active"
  | "resolved"
  | "completed"
  | "success"
  | "green"
  | "neutral";

export function actionButtonClass(tone?: ActionTone | string): string {
  switch (tone) {
    case "critical":
    case "urgent":
    case "blocked":
    case "danger":
    case "red":
      return buttons.compactDanger;

    case "high":
    case "medium":
    case "watch":
    case "warning":
    case "orange":
    case "yellow":
      return buttons.compactWarning;

    case "low":
    case "open":
    case "info":
    case "blue":
    case "active":
      return buttons.compactPrimary;

    case "resolved":
    case "completed":
    case "success":
    case "green":
      return buttons.compactSuccess;

    default:
      return buttons.compactSecondary;
  }
}

export function metricActionButtonClass(tone?: ActionTone | string): string {
  return ["mt-auto w-full", actionButtonClass(tone)].join(" ");
}
