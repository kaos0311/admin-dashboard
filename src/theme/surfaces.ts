export const surfaces = {
  /* ---- Legacy aliases for backward compat ---- */
  panelBefore: "",

  page:
    "relative min-h-screen w-full overflow-x-hidden text-[#ececec]",

  shell:
    "relative z-10 mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-7",

  shellTight:
    "relative z-10 mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-7",

  shellFull:
    "relative z-10 flex w-full min-w-0 flex-col gap-7",

  panel:
    "relative min-w-0 overflow-visible rounded-2xl border border-[#3a3a3a] bg-[#1c1c1c] shadow-lg shadow-black/25",

  panelPadded:
    "relative min-w-0 overflow-visible rounded-2xl border border-[#3a3a3a] bg-[#1c1c1c] p-5 shadow-lg shadow-black/25 sm:p-6",

  card:
    "relative min-w-0 overflow-visible rounded-2xl border border-[#3a3a3a] bg-[#1c1c1c] shadow-lg shadow-black/25",

  cardPadded:
    "relative min-w-0 overflow-visible rounded-2xl border border-[#3a3a3a] bg-[#1c1c1c] p-5 shadow-lg shadow-black/25 sm:p-6",

  cardHover:
    "transition duration-200 hover:-translate-y-0.5 hover:border-[#5a5a5a] hover:bg-[#242424]",

  statCard:
    "relative min-w-0 overflow-visible rounded-2xl border border-[#3a3a3a] bg-[#1c1c1c] p-5 shadow-lg shadow-black/25 sm:p-6",

  listItem:
    "relative min-w-0 rounded-xl border border-[#3a3a3a] bg-[#1c1c1c] p-4 transition hover:border-[#5a5a5a] hover:bg-[#242424]",

  menuItem:
    "flex gap-3 border-b border-[#2a2a2a] px-4 py-3 transition last:border-b-0 hover:bg-[#2a2a2a]",

  selectedListItem:
    "border-[#7a9a5e]/40 bg-[#7a9a5e]/10",

  inset:
    "min-w-0 rounded-xl border border-[#3a3a3a] bg-[#181818] shadow-inner shadow-black/40",

  insetPadded:
    "min-w-0 rounded-xl border border-[#3a3a3a] bg-[#181818] p-4 shadow-inner shadow-black/40",

  toolbar:
    "min-w-0 rounded-xl border border-[#3a3a3a] bg-[#1c1c1c] shadow-lg shadow-black/25",

  toolbarPadded:
    "min-w-0 rounded-xl border border-[#3a3a3a] bg-[#1c1c1c] p-4 shadow-lg shadow-black/25",

  input:
    "w-full rounded-xl border border-[#3a3a3a] bg-[#181818] text-[#ececec] outline-none placeholder:text-[#606060] shadow-inner shadow-black/40 transition focus:border-[#5a5a5a] focus:bg-[#1e1e1e] disabled:cursor-not-allowed disabled:opacity-60",

  inputPadded:
    "w-full rounded-xl border border-[#3a3a3a] bg-[#181818] px-4 py-3 text-[#ececec] outline-none placeholder:text-[#606060] shadow-inner shadow-black/40 transition focus:border-[#5a5a5a] focus:bg-[#1e1e1e] disabled:cursor-not-allowed disabled:opacity-60",

  textarea:
    "w-full min-h-[160px] resize-none rounded-xl border border-[#3a3a3a] bg-[#181818] px-4 py-3 text-[#ececec] outline-none placeholder:text-[#606060] shadow-inner shadow-black/40 transition focus:border-[#5a5a5a] focus:bg-[#1e1e1e] disabled:cursor-not-allowed disabled:opacity-60",

  select:
    "w-full rounded-xl border border-[#3a3a3a] bg-[#181818] px-4 py-3 text-[#ececec] outline-none shadow-inner shadow-black/40 transition focus:border-[#5a5a5a] focus:bg-[#1e1e1e] disabled:cursor-not-allowed disabled:opacity-60",

  chip:
    "inline-flex max-w-full min-w-0 items-center gap-2 break-words rounded-full border border-[#3a3a3a] bg-[#222222] px-3 py-1 text-xs font-semibold uppercase leading-5 tracking-[0.16em] text-[#b8b8b8]",

  iconBox:
    "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#3a3a3a] bg-[#222222] text-[#9aba7e] shadow-lg shadow-black/20",

  iconBoxSm:
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#3a3a3a] bg-[#222222] text-[#9aba7e] shadow-lg shadow-black/20",

  emptyState:
    "rounded-xl border border-dashed border-[#3a3a3a] bg-[#1a1a1a] p-6 text-center",

  alertInfo:
    "rounded-xl border border-[#7a9a5e]/25 bg-[#7a9a5e]/8 p-4 text-[#9aba7e]",
  alertSuccess:
    "rounded-xl border border-[#6a9a6a]/25 bg-[#6a9a6a]/8 p-4 text-[#8aba8a]",
  alertWarning:
    "rounded-xl border border-[#c49a4a]/25 bg-[#c49a4a]/8 p-4 text-[#d4b86a]",
  alertDanger:
    "rounded-xl border border-[#b84a4a]/25 bg-[#b84a4a]/8 p-4 text-[#d47a7a]",

  table:
    "overflow-x-auto rounded-xl border border-[#3a3a3a]",
  tableHeader:
    "bg-[#222222] text-[#888888]",
  tableRow:
    "border-b border-[#2a2a2a] transition hover:bg-[#222222]",
  tableCell:
    "px-4 py-3 text-sm text-[#b8b8b8]",

  divider:
    "border-[#2a2a2a]",

  progressTrack:
    "h-2 overflow-hidden rounded-full bg-[#2a2a2a] shadow-inner shadow-black/40",
  progressFill:
    "h-full rounded-full bg-[var(--color-accent,#7a9a5e)] transition-all duration-300",

  riskHigh:
    "h-full rounded-full bg-[#b84a4a]",
  riskMedium:
    "h-full rounded-full bg-[#c49a4a]",
  riskLow:
    "h-full rounded-full bg-[#7a9a5e]",
  riskMinimal:
    "h-full rounded-full bg-[#606060]",

  focus:
    "focus:outline-none focus:ring-2 focus:ring-[#7a9a5e]/40 focus:ring-offset-0",
  pageCenter:
    "flex min-h-screen items-center justify-center bg-[#141414] px-4 text-[#ececec]",

  loadingCard:
    "rounded-2xl border border-[#3a3a3a] bg-[#1c1c1c] px-6 py-4 text-sm text-[#b8b8b8] shadow-lg shadow-black/25",

  authCard:
    "w-full max-w-md space-y-5 rounded-2xl border border-[#3a3a3a] bg-[#1c1c1c] p-6 shadow-2xl shadow-black/40",

  dangerPanel:
    "w-full max-w-md rounded-2xl border border-[#b84a4a]/25 bg-[#2a1414] p-8 text-[#d47a7a] shadow-2xl shadow-black/40",

  inputIcon:
    "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#606060]",
} as const;

export type SurfaceKey = keyof typeof surfaces;
