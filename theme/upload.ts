import { buttons } from "./buttons";
import { colors } from "./colors";
import { forms } from "./forms";
import { surfaces } from "./surfaces";

export const uploadUi = {
  page: `${surfaces.page} ${colors.app}`,

  shell:
    "relative z-10 mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8",

  hero: `${surfaces.panel} p-6 sm:p-8`,

  panel: surfaces.panel,

  card: surfaces.card,

  badge:
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",

  icon:
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border",

  input: forms.input,

  buttonPrimary: buttons.primary,

  buttonGhost: buttons.ghost,
} as const;

export type UploadUiKey = keyof typeof uploadUi;
