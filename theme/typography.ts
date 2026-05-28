export const typography = {
  hero: "text-4xl font-black tracking-tight text-white sm:text-5xl",

  pageTitle:
    "text-3xl font-black tracking-tight text-white sm:text-4xl",

  sectionTitle:
    "text-xl font-bold tracking-tight text-white sm:text-2xl",

  cardTitle:
    "text-base font-bold tracking-tight text-white sm:text-lg",

  body:
    "text-sm leading-6 text-slate-300",

  bodyMuted:
    "text-sm leading-6 text-slate-400",

  caption:
    "text-xs font-medium uppercase tracking-[0.2em] text-slate-500",

  label:
    "text-xs font-semibold uppercase tracking-[0.16em] text-slate-400",
} as const;

export type TypographyKey = keyof typeof typography;