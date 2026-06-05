export const tiles = {
  base:
    "relative flex min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] shadow-xl shadow-black/25 backdrop-blur-xl",

  hover:
    "transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.07]",

  metric: "p-5 sm:p-6",
  action: "p-5 sm:p-6",
  operational: "p-5 sm:p-6",
  compact: "p-4 sm:p-5",

  alert:
    "border-rose-400/25 bg-rose-500/[0.08] p-5 shadow-[0_0_45px_rgba(244,63,94,0.10)] sm:p-6",

  system:
    "border-cyan-300/20 bg-cyan-400/[0.045] p-5 shadow-[0_0_45px_rgba(34,211,238,0.08)] sm:p-6",

  header: "flex min-w-0 items-start justify-between gap-4",

  icon:
    "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] p-3 text-cyan-200 shadow-lg shadow-black/20",

  label:
    "block truncate text-xs font-semibold uppercase leading-5 tracking-[0.14em] text-slate-400",

  title:
    "min-w-0 break-words text-base font-bold leading-6 tracking-tight text-white sm:text-lg sm:leading-7",

  value:
    "mt-3 min-w-0 break-words text-3xl font-black leading-none tracking-tight text-white",

  helper:
    "mt-2 min-w-0 break-words text-xs leading-5 text-slate-400",

  description:
    "min-w-0 break-words text-sm leading-6 text-slate-400",

  badge:
    "inline-flex max-w-full min-w-0 shrink-0 items-center truncate rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-[0.68rem] font-black uppercase leading-none tracking-[0.18em] text-slate-200",

  tag:
    "min-w-0 max-w-full truncate rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-slate-300",

  tagMuted:
    "rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-slate-400",

  gridMetrics:
    "grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0",

  gridSections:
    "grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0",

  gridTwo:
    "grid min-w-0 gap-4 lg:grid-cols-2 [&>*]:min-w-0",
} as const;

export type TileKey = keyof typeof tiles;

