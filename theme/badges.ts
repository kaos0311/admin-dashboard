export const badges = {
  success:
    "border border-emerald-400/25 bg-emerald-400/10 text-emerald-100",

  warning:
    "border border-amber-400/25 bg-amber-400/10 text-amber-100",

  danger:
    "border border-rose-400/25 bg-rose-400/10 text-rose-100",

  info:
    "border border-cyan-400/25 bg-cyan-400/10 text-cyan-100",

  neutral:
    "border border-white/10 bg-white/[0.06] text-slate-300",

  active:
    "border border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
} as const;

export type BadgeKey = keyof typeof badges;
