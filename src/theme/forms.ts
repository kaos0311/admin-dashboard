import { surfaces } from "./surfaces";
import { typography } from "./typography";

export const forms = {
  input: surfaces.inputPadded,

  textarea: surfaces.textarea,

  textareaCompact:
    [
      "min-h-28",
      surfaces.inputPadded,
    ].join(" "),

  select: surfaces.select,

  label: typography.formLabel,

  helper: typography.helper,

  error:
    "text-xs font-medium text-[#d47a7a]",

  field:
    "space-y-2",

  inputIconLeft:
    [
      surfaces.inputPadded,
      "pl-11",
    ].join(" "),

  inputIconBoth:
    [
      surfaces.inputPadded,
      "pl-11 pr-12",
    ].join(" "),

  fileInput:
    "block w-full rounded-xl border border-[#3a3a3a] bg-[#181818] px-4 py-3 text-sm text-[#b8b8b8] file:mr-4 file:rounded-lg file:border-0 file:bg-[#ececec] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#141414] disabled:opacity-60",

} as const;

export type FormKey = keyof typeof forms;
