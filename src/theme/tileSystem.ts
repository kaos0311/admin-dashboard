export const tiles = {
  base:
    "relative flex min-w-0 flex-col overflow-visible rounded-2xl border border-[#3a3a3a] bg-[#1c1c1c] shadow-lg shadow-black/25",

  hover:
    "transition duration-200 hover:-translate-y-0.5 hover:border-[#5a5a5a] hover:bg-[#242424]",

  metric: "p-5 sm:p-6",
  action: "p-5 sm:p-6",
  operational: "p-5 sm:p-6",
  compact: "p-4 sm:p-5",

  alert:
    "border-[#b84a4a]/30 bg-[#2a1414] p-5 sm:p-6",

  system:
    "border-[#7a9a5e]/25 bg-[#1c2a1c] p-5 sm:p-6",

  header: "flex min-w-0 items-start justify-between gap-4",

  icon:
    "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#3a3a3a] bg-[#222222] p-3 text-[#9aba7e] shadow-lg shadow-black/20",

  label:
    "block break-words text-xs font-semibold uppercase leading-5 tracking-[0.14em] text-[#888888]",

  metricLabel:
    "block min-w-0 max-w-full break-words text-[0.7rem] font-semibold uppercase leading-5 text-[#888888]",

  title:
    "min-w-0 break-words text-base font-bold leading-6 tracking-tight text-[#ececec] sm:text-lg sm:leading-7",

  value:
    "mt-3 min-w-0 break-words text-3xl font-black leading-[1.15] tracking-tight text-[#ececec]",

  helper:
    "mt-2 min-w-0 break-words text-xs leading-5 text-[#888888]",

  description:
    "min-w-0 break-words text-sm leading-6 text-[#888888]",

  badge:
    "inline-flex max-w-full min-w-0 shrink-0 items-center break-words rounded-full border border-[#3a3a3a] bg-[#222222] px-3 py-1.5 text-[0.68rem] font-black uppercase leading-5 tracking-[0.18em] text-[#b8b8b8]",

  tag:
    "min-w-0 max-w-full break-words rounded-full border border-[#3a3a3a] bg-[#181818] px-2.5 py-1 text-xs leading-5 text-[#b8b8b8]",

  tagMuted:
    "rounded-full border border-[#3a3a3a] bg-[#1a1a1a] px-2.5 py-1 text-xs text-[#606060]",

  gridMetrics:
    "grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0",

  gridSections:
    "grid min-w-0 gap-5 lg:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0",

  gridTwo:
    "grid min-w-0 gap-5 lg:grid-cols-2 [&>*]:min-w-0",
} as const;

export type TileKey = keyof typeof tiles;
