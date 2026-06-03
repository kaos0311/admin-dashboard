import { glass } from "./glass";
import { typography } from "./typography";

export const forms = {
  input: glass.inputPadded,

  textarea: glass.textarea,

  textareaCompact:
    [
      "min-h-28",
      glass.inputPadded,
    ].join(" "),

  select: glass.select,

  label: typography.formLabel,

  helper: typography.helper,

  error:
    "text-xs font-medium text-rose-300",

  field:
    "space-y-2",
  inputIconLeft:
    [
      glass.inputPadded,
      "pl-11",
    ].join(" "),

  inputIconBoth:
    [
      glass.inputPadded,
      "pl-11 pr-12",
    ].join(" "),

  fileInput:
    "block w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-black disabled:opacity-60",

} as const;

export type FormKey = keyof typeof forms;


