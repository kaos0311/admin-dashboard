export const buttons = {
  primary:
    "inline-flex min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-cyan-300/35 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/25 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",

  primaryLg:
    "inline-flex min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-cyan-300/35 bg-cyan-400/15 px-5 py-3 text-sm font-bold text-cyan-50 transition hover:bg-cyan-400/25 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",

  secondary:
    "inline-flex min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:border-white/15 hover:bg-white/[0.10] focus:outline-none focus:ring-2 focus:ring-white/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",

  ghost:
    "inline-flex min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",

  danger:
    "inline-flex min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-50 transition hover:bg-rose-500/25 focus:outline-none focus:ring-2 focus:ring-rose-300/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",

  success:
    "inline-flex min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500/25 focus:outline-none focus:ring-2 focus:ring-emerald-300/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",

  warning:
    "inline-flex min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-amber-500/25 focus:outline-none focus:ring-2 focus:ring-amber-300/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",

  toolbar:
    "inline-flex min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300 transition hover:bg-white/[0.10] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",

  icon:
    "inline-flex h-10 w-10 min-w-0 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-white backdrop-blur-xl transition-colors duration-200 hover:bg-white/[0.14] focus:outline-none focus:ring-2 focus:ring-cyan-300/40 active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",

  iconSm:
    "inline-flex h-8 w-8 min-w-0 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] text-white backdrop-blur-xl transition-colors duration-200 hover:bg-white/[0.14] focus:outline-none focus:ring-2 focus:ring-cyan-300/40 active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
} as const;

export type ButtonKey = keyof typeof buttons;
