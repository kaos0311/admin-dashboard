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
  textInverse: "text-slate-950",

  border: "border-white/10",
  borderStrong: "border-white/15",
  borderMuted: "border-white/[0.06]",

  surface:
    "bg-white/[0.045]",

  surfaceHover:
    "hover:bg-white/[0.07]",

  surfaceStrong:
    "bg-white/[0.08]",

  surfaceInset:
    "bg-black/25",

  surfaceInput:
    "bg-black/45",

  surfaceInputFocus:
    "focus:bg-black/55",

  overlay:
    "bg-slate-950/70",

  shadow:
    "shadow-xl shadow-black/25",

  shadowStrong:
    "shadow-2xl shadow-black/35",

  success:
    "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",

  warning:
    "border-amber-400/25 bg-amber-400/10 text-amber-100",

  danger:
    "border-rose-400/25 bg-rose-400/10 text-rose-100",

  info:
    "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",

  neutral:
    "border-white/10 bg-white/[0.06] text-slate-300",

  successBadge:
    "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",

  warningBadge:
    "border-amber-400/25 bg-amber-400/10 text-amber-100",

  dangerBadge:
    "border-rose-400/25 bg-rose-400/10 text-rose-100",

  infoBadge:
    "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",

  neutralBadge:
    "border-white/10 bg-white/[0.06] text-slate-300",

  activeBadge:
    "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",

  pulse:
    "bg-cyan-300 shadow-[0_0_10px_rgba(125,211,252,0.9)]",

  dangerPulse:
    "bg-rose-300 shadow-[0_0_10px_rgba(253,164,175,0.9)]",

  successPulse:
    "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]",
} as const;

export type ColorKey = keyof typeof colors;
