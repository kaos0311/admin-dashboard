export const spacing = {
  page:
    "px-4 py-6 sm:px-6 lg:px-8",

  pageTight:
    "px-4 py-4 sm:px-6 lg:px-8",

  section:
    "p-5 sm:p-6",

  sectionTight:
    "p-4 sm:p-5",

  card:
    "p-4 sm:p-5",

  cardLg:
    "p-5 sm:p-6",

  stack:
    "space-y-7",

  stackTight:
    "space-y-5",

  stackLoose:
    "space-y-10",

  inline:
    "flex items-center gap-2",

  inlineMd:
    "flex items-center gap-3",

  inlineLg:
    "flex items-center gap-4",

  actions:
    "flex flex-wrap items-center gap-3",

  gridCards:
    "grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-4",

  gridCardsThree:
    "grid min-w-0 gap-5 md:grid-cols-3",

  gridCardsTwo:
    "grid min-w-0 gap-5 md:grid-cols-2",

  gridResponsive:
    "grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-4",

  gridTwo:
    "grid min-w-0 gap-5 lg:grid-cols-2",

  gridThree:
    "grid min-w-0 gap-5 lg:grid-cols-3",

  gridFour:
    "grid min-w-0 gap-5 lg:grid-cols-4",

  split:
    "grid min-w-0 gap-7 lg:grid-cols-[2fr_1fr]",

  content:
    "mx-auto w-full max-w-7xl",

  contentTight:
    "mx-auto w-full max-w-5xl",
} as const;

export type SpacingKey = keyof typeof spacing;
