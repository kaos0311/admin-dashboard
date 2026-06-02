export const typography = {
  hero:
    "text-4xl font-black tracking-tight text-white sm:text-5xl",

  pageTitle:
    "text-3xl font-black tracking-tight text-white sm:text-4xl",

  sectionTitle:
    "text-xl font-bold tracking-tight text-white sm:text-2xl",

  cardTitle:
    "text-base font-bold tracking-tight text-white sm:text-lg",

  subTitle:
    "text-sm font-semibold tracking-tight text-slate-200",

  body:
    "text-sm leading-6 text-slate-300",

  bodyStrong:
    "text-sm font-semibold leading-6 text-white",

  bodyMuted:
    "text-sm leading-6 text-slate-400",

  bodyFaint:
    "text-sm leading-6 text-slate-500",

  small:
    "text-xs leading-5 text-slate-400",

  smallMuted:
    "text-xs leading-5 text-slate-500",

  caption:
    "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500",

  eyebrow:
    "text-xs font-semibold uppercase tracking-[0.18em] text-slate-400",

  label:
    "text-xs font-semibold uppercase tracking-[0.16em] text-slate-400",

  formLabel:
    "text-xs font-semibold uppercase tracking-[0.16em] text-slate-400",

  helper:
    "text-xs leading-5 text-slate-500",

  metric:
    "text-3xl font-black tracking-tight text-white",

  metricCompact:
    "text-2xl font-black tracking-tight text-white",

  metricSmall:
    "text-xl font-black tracking-tight text-white",

  mono:
    "font-mono text-sm tracking-tight",

  monoMuted:
    "font-mono text-xs tracking-tight text-slate-400",

  code:
    "rounded-lg bg-black/30 px-1.5 py-0.5 font-mono text-[0.82rem] text-cyan-200",
} as const;

export type TypographyKey = keyof typeof typography;
