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

  kpiCard: {
    neutral: "border-white/10 bg-neutral-950 text-white",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    red: "border-red-500/30 bg-red-500/10 text-red-300",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  },

  kpiIcon: {
    neutral: "border-white/10 bg-white/5 text-neutral-400",
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    yellow: "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
  },
  pulseDot:
    "h-2 w-2 animate-pulse rounded-full bg-sky-200 shadow-[0_0_10px_rgba(186,230,253,0.9)]",

} as const;

export type BadgeKey = keyof typeof badges;

