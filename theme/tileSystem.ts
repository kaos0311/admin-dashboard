export const tiles = {
  base:
    "relative flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/75 shadow-xl shadow-black/10 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] dark:shadow-black/25",

  hover:
    "transition-colors duration-200 hover:border-cyan-500/35 hover:bg-white/90 hover:shadow-[0_18px_55px_rgba(8,145,178,0.12)] dark:hover:border-cyan-300/35 dark:hover:bg-white/[0.07]",

  metric: "p-5 sm:p-6",
  action: "p-5 sm:p-6",
  operational: "p-5 sm:p-6",

  alert:
    "border-rose-300/50 bg-rose-50/80 p-5 shadow-[0_0_45px_rgba(244,63,94,0.10)] sm:p-6 dark:border-rose-400/25 dark:bg-rose-500/[0.06]",

  system:
    "border-cyan-300/40 bg-cyan-50/80 p-5 shadow-[0_0_45px_rgba(34,211,238,0.08)] sm:p-6 dark:border-cyan-300/20 dark:bg-cyan-400/[0.045]",

  compact: "p-4 sm:p-5",

  header: "flex min-w-0 items-start justify-between gap-4",

  icon:
    "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white/70 p-3 text-cyan-700 shadow-lg shadow-black/10 dark:border-white/10 dark:bg-white/[0.08] dark:text-cyan-200 dark:shadow-black/20",

  label:
    "block truncate text-xs font-semibold uppercase leading-5 tracking-[0.14em] text-slate-500 dark:text-slate-400",

  title:
    "min-w-0 break-words text-base font-bold leading-6 tracking-tight text-slate-950 sm:text-lg sm:leading-7 dark:text-white",

  value:
    "mt-3 min-w-0 break-words text-3xl font-black leading-none tracking-tight text-slate-950 dark:text-white",

  helper:
    "mt-2 min-w-0 break-words text-xs leading-5 text-slate-600 dark:text-slate-400",

  description:
    "min-w-0 break-words text-sm leading-6 text-slate-600 dark:text-slate-400",

  badge:
    "inline-flex max-w-full min-w-0 shrink-0 items-center truncate rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-[0.68rem] font-black uppercase leading-none tracking-[0.18em] text-slate-700 dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-200",

  gridMetrics:
    "grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0",

  gridSections:
    "grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0",

  gridTwo:
    "grid min-w-0 gap-4 lg:grid-cols-2 [&>*]:min-w-0",
} as const;

export type TileKey = keyof typeof tiles;
