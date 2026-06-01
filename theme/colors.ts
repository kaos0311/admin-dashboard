export const colors = {
  app:
    "relative isolate overflow-x-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.13),transparent_34%),radial-gradient(circle_at_0%_20%,rgba(14,165,233,0.10),transparent_28%),radial-gradient(circle_at_100%_18%,rgba(99,102,241,0.12),transparent_30%),linear-gradient(135deg,#020617_0%,#06111f_44%,#020617_100%)]",

  grid:
    "pointer-events-none fixed inset-0 -z-20 bg-[linear-gradient(to_right,rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30",

  vignette:
    "pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.34)_70%,rgba(0,0,0,0.78)_100%)]",

  textPrimary: "text-white",
  textSecondary: "text-slate-300",
  textMuted: "text-slate-400",
  textFaint: "text-slate-500",

  border: "border-white/10",
  borderStrong: "border-white/15",

  successBadge:
    "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",

  warningBadge:
    "border-amber-400/25 bg-amber-400/10 text-amber-100",

  dangerBadge:
    "border-rose-400/25 bg-rose-400/10 text-rose-100",

  infoBadge:
    "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
} as const;

export type ColorKey = keyof typeof colors;
