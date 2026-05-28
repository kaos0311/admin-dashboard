export const tiles = {
  base:
    "relative flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] shadow-xl shadow-black/25 backdrop-blur-xl",

  hover:
    "transition-colors duration-200 hover:border-cyan-300/35 hover:bg-white/[0.07] hover:shadow-[0_18px_55px_rgba(8,145,178,0.12)]",

  metric:
    "min-h-[132px] p-4 sm:p-5",

  action:
    "min-h-[168px] p-5 sm:p-6",

  operational:
    "min-h-[190px] p-5 sm:p-6",

  alert:
    "min-h-[160px] border-rose-400/25 bg-rose-500/[0.06] p-5 sm:p-6 shadow-[0_0_45px_rgba(244,63,94,0.10)]",

  system:
    "min-h-[150px] border-cyan-300/20 bg-cyan-400/[0.045] p-5 sm:p-6 shadow-[0_0_45px_rgba(34,211,238,0.08)]",

  compact:
    "min-h-[92px] p-4",

  header:
    "flex min-w-0 items-start justify-between gap-4",

  icon:
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] p-3 text-cyan-200 shadow-lg shadow-black/20 light:border-slate-200 light:bg-white/70 light:text-cyan-700",

  label:
    "truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 light:text-slate-500",

  title:
    "min-w-0 break-words text-base font-bold tracking-tight text-white sm:text-lg light:text-slate-950",

  value:
    "mt-3 min-w-0 break-words text-3xl font-black tracking-tight text-white light:text-slate-950",

  helper:
    "mt-2 min-w-0 break-words text-xs text-slate-400 light:text-slate-600",

  description:
    "min-w-0 break-words text-sm leading-6 text-slate-400 light:text-slate-600",

  badge:
    "inline-flex max-w-full min-w-0 shrink-0 items-center truncate rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.2em] text-slate-200 light:border-slate-200 light:bg-white/70 light:text-slate-700",

  gridMetrics:
    "grid min-w-0 auto-rows-fr items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full [&>*]:min-w-0",

  gridSections:
    "grid min-w-0 auto-rows-fr items-stretch gap-4 lg:grid-cols-2 xl:grid-cols-4 [&>*]:h-full [&>*]:min-w-0",

  gridTwo:
    "grid min-w-0 auto-rows-fr items-stretch gap-4 lg:grid-cols-2 [&>*]:h-full [&>*]:min-w-0",
} as const;

export type TileKey = keyof typeof tiles;