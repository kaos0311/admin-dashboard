export const glass = {
  page:
    "relative min-h-screen w-full overflow-x-hidden text-white",

  shell:
    "relative z-10 mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-7",

  shellTight:
    "relative z-10 mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-7",

  shellFull:
    "relative z-10 flex w-full min-w-0 flex-col gap-7",

  panel:
    "relative min-w-0 overflow-visible rounded-3xl border border-white/10 bg-white/[0.06] shadow-xl shadow-black/20 backdrop-blur-2xl",

  panelBefore:
    "before:pointer-events-none before:absolute before:inset-0 before:rounded-[2rem] before:bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.08),transparent_42%)] before:opacity-70",

  panelPadded:
    "relative min-w-0 overflow-visible rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl sm:p-6",

  card:
    "relative min-w-0 overflow-visible rounded-3xl border border-white/10 bg-white/[0.06] shadow-xl shadow-black/20 backdrop-blur-2xl",

  cardPadded:
    "relative min-w-0 overflow-visible rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl sm:p-6",

  cardHover:
    "transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.07]",

  statCard:
    "relative min-w-0 overflow-visible rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl sm:p-6",

  listItem:
    "relative min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl transition hover:border-cyan-300/30 hover:bg-white/[0.08]",

  menuItem:
    "flex gap-3 border-b border-white/5 px-4 py-3 transition last:border-b-0 hover:bg-white/10",

  selectedListItem:
    "border-cyan-300/35 bg-cyan-300/10",

  inset:
    "min-w-0 rounded-2xl border border-white/10 bg-black/25",

  insetPadded:
    "min-w-0 rounded-2xl border border-white/10 bg-black/25 p-4",

  toolbar:
    "min-w-0 rounded-2xl border border-white/10 bg-slate-950/58 shadow-lg shadow-black/25 backdrop-blur-xl",

  toolbarPadded:
    "min-w-0 rounded-2xl border border-white/10 bg-slate-950/58 p-4 shadow-lg shadow-black/25 backdrop-blur-xl",

  input:
    "w-full rounded-2xl border border-white/10 bg-black/45 text-white outline-none placeholder:text-slate-600 shadow-inner shadow-black/20 backdrop-blur-xl transition focus:border-white/30 focus:bg-black/55 disabled:cursor-not-allowed disabled:opacity-60",

  inputPadded:
    "w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-white outline-none placeholder:text-slate-600 shadow-inner shadow-black/20 backdrop-blur-xl transition focus:border-white/30 focus:bg-black/55 disabled:cursor-not-allowed disabled:opacity-60",

  textarea:
    "w-full min-h-[160px] resize-none rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-white outline-none placeholder:text-slate-600 shadow-inner shadow-black/20 backdrop-blur-xl transition focus:border-white/30 focus:bg-black/55 disabled:cursor-not-allowed disabled:opacity-60",

  select:
    "w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-white outline-none shadow-inner shadow-black/20 backdrop-blur-xl transition focus:border-white/30 focus:bg-black/55 disabled:cursor-not-allowed disabled:opacity-60",

  chip:
    "inline-flex max-w-full min-w-0 items-center gap-2 break-words rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase leading-5 tracking-[0.16em] text-slate-300 backdrop-blur-xl",

  iconBox:
    "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-cyan-200 shadow-lg shadow-black/20 backdrop-blur-xl",

  iconBoxSm:
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] text-cyan-200 shadow-lg shadow-black/20 backdrop-blur-xl",

  emptyState:
    "rounded-2xl border border-dashed border-white/10 bg-white/[0.035] p-6 text-center backdrop-blur-xl",

  alertInfo:
    "rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-cyan-100 backdrop-blur-xl",

  alertSuccess:
    "rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-emerald-100 backdrop-blur-xl",

  alertWarning:
    "rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-100 backdrop-blur-xl",

  alertDanger:
    "rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-100 backdrop-blur-xl",

  table:
    "overflow-x-auto rounded-2xl border border-white/10",

  tableHeader:
    "bg-white/5 text-slate-400 backdrop-blur-xl",

  tableRow:
    "border-b border-white/10 transition hover:bg-white/[0.04]",

  tableCell:
    "px-4 py-3 text-sm text-slate-300",

  divider:
    "border-white/10",

  progressTrack:
    "h-2 overflow-hidden rounded-full bg-white/10",
  progressFill: "h-full rounded-full bg-[var(--color-accent)] transition-all duration-300",

  riskHigh:
    "h-full rounded-full bg-rose-500",

  riskMedium:
    "h-full rounded-full bg-amber-400",

  riskLow:
    "h-full rounded-full bg-cyan-400",

  riskMinimal:
    "h-full rounded-full bg-slate-400",

  focus:
    "focus:outline-none focus:ring-2 focus:ring-cyan-300/40 focus:ring-offset-0",
  pageCenter:
    "flex min-h-screen items-center justify-center bg-black px-4 text-white",

  loadingCard:
    "flex items-center gap-3 rounded-3xl border border-white/10 bg-neutral-950 px-6 py-4 text-sm text-zinc-300 shadow-2xl shadow-black/30",

  authCard:
    "w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl shadow-black/40",

  inputIcon:
    "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500",

} as const;

export type GlassKey = keyof typeof glass;

