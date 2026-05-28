export const glass = {
  page:
    "relative min-h-screen w-full overflow-x-hidden text-white",

  shell:
    "relative z-10 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8",

  shellTight:
    "relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8",

  shellFull:
    "relative z-10 w-full px-4 py-6 sm:px-6 lg:px-8",

  panel:
    "relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/48 shadow-[0_20px_80px_rgba(0,0,0,0.42),0_0_45px_rgba(34,211,238,0.075)] backdrop-blur-2xl",

  panelBefore:
    "before:pointer-events-none before:absolute before:inset-0 before:rounded-[2rem] before:bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.105),transparent_42%)] before:opacity-80",

  card:
    "relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] shadow-xl shadow-black/25 backdrop-blur-xl",

  cardHover:
    "transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.07] hover:shadow-[0_18px_55px_rgba(8,145,178,0.12)]",

  inset:
    "rounded-2xl border border-white/10 bg-black/25",

  toolbar:
    "rounded-2xl border border-white/10 bg-slate-950/58 shadow-lg shadow-black/25 backdrop-blur-xl",

  divider:
    "border-white/10",

  focus:
    "focus:outline-none focus:ring-2 focus:ring-cyan-300/40 focus:ring-offset-0",
};