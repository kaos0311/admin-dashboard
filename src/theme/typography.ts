export const typography = {
  hero:
    "break-words text-4xl font-black leading-[1.12] tracking-tight text-[#ececec] sm:text-5xl",

  pageTitle:
    "break-words text-3xl font-black leading-[1.15] tracking-tight text-[#ececec] sm:text-4xl",

  sectionTitle:
    "break-words text-xl font-bold leading-tight tracking-tight text-[#ececec] sm:text-2xl",

  cardTitle:
    "text-base font-bold leading-tight tracking-tight text-[#ececec] sm:text-lg",

  subTitle:
    "text-sm font-semibold tracking-tight text-[#b8b8b8]",

  body:
    "text-sm leading-6 text-[#b8b8b8]",

  bodyStrong:
    "text-sm font-semibold leading-6 text-[#ececec]",

  warningStrong:
    "text-sm font-semibold leading-6 text-[#d4b86a]",

  warningText:
    "text-xs leading-5 text-[#d4b86a]",

  dangerText:
    "text-xs leading-5 text-[#d47a7a]",

  bodyMuted:
    "text-sm leading-6 text-[#888888]",

  bodyFaint:
    "text-sm leading-6 text-[#606060]",

  small:
    "text-xs leading-5 text-[#888888]",

  smallMuted:
    "text-xs leading-5 text-[#606060]",

  caption:
    "text-xs font-semibold uppercase tracking-[0.18em] text-[#606060]",

  eyebrow:
    "text-xs font-semibold uppercase tracking-[0.18em] text-[#888888]",

  label:
    "text-xs font-semibold uppercase tracking-[0.16em] text-[#888888]",

  formLabel:
    "text-xs font-semibold uppercase tracking-[0.16em] text-[#888888]",

  helper:
    "text-xs leading-5 text-[#606060]",

  metric:
    "text-3xl font-black tracking-tight text-[#ececec]",

  metricCompact:
    "text-2xl font-black tracking-tight text-[#ececec]",

  metricSmall:
    "text-xl font-black tracking-tight text-[#ececec]",

  mono:
    "font-mono text-sm tracking-tight",

  monoMuted:
    "font-mono text-xs tracking-tight text-[#888888]",

  code:
    "rounded-lg bg-[#222222] px-1.5 py-0.5 font-mono text-[0.82rem] text-[#9aba7e]",
} as const;

export type TypographyKey = keyof typeof typography;
