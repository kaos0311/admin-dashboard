export const glass = {
  page: "relative min-h-screen w-full overflow-x-hidden text-white",

  shell: "relative z-10 mx-auto w-full max-w-7xl min-w-0",
  shellTight: "relative z-10 mx-auto w-full max-w-6xl min-w-0",
  shellFull: "relative z-10 w-full min-w-0",

  panel:
    "relative min-w-0 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/48 shadow-xl shadow-black/30 backdrop-blur-2xl",

  panelBefore:
    "before:pointer-events-none before:absolute before:inset-0 before:rounded-[2rem] before:bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.08),transparent_42%)] before:opacity-70",

  card:
    "relative min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] shadow-xl shadow-black/25 backdrop-blur-xl",

  cardHover:
    "transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.07]",

  inset: "min-w-0 rounded-2xl border border-white/10 bg-black/25",

  toolbar:
    "min-w-0 rounded-2xl border border-white/10 bg-slate-950/58 shadow-lg shadow-black/25 backdrop-blur-xl",

  input:
    "w-full rounded-2xl border border-white/10 bg-black/45 text-white outline-none placeholder:text-slate-600 shadow-inner shadow-black/20 backdrop-blur-xl transition focus:border-white/30 focus:bg-black/55 disabled:cursor-not-allowed disabled:opacity-60",

  select:
    "w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-white outline-none shadow-inner shadow-black/20 backdrop-blur-xl transition focus:border-white/30 focus:bg-black/55 disabled:cursor-not-allowed disabled:opacity-60",

  table: "overflow-x-auto rounded-2xl border border-white/10",

  tableHeader: "bg-white/5 text-slate-400 backdrop-blur-xl",

  divider: "border-white/10",

  focus:
    "focus:outline-none focus:ring-2 focus:ring-cyan-300/40 focus:ring-offset-0",
} as const;

export type GlassKey = keyof typeof glass;
