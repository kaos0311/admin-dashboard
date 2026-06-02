import { glass } from "./glass";
import { typography } from "./typography";

export const forms = {
  input: glass.inputPadded,

  textarea: glass.textarea,

  select: glass.select,

  label: typography.formLabel,

  helper: typography.helper,

  error:
    "text-xs font-medium text-rose-300",

  field:
    "space-y-2",
} as const;

export type FormKey = keyof typeof forms;
