import { buttons } from "./buttons";
import { colors } from "./colors";
import { forms } from "./forms";
import { glass } from "./glass";

export const uploadUi = {
  page: `${glass.page} ${colors.app}`,

  shell:
    "relative z-10 mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8",

  hero: `${glass.panel} p-6 sm:p-8`,

  panel: glass.panel,

  card: glass.card,

  badge:
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",

  icon:
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",

  input: forms.input,

  buttonPrimary: buttons.primary,

  buttonGhost: buttons.ghost,
} as const;

export type UploadUiKey = keyof typeof uploadUi;
