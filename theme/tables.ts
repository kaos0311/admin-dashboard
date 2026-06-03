import { buttons } from "./buttons";
import { colors } from "./colors";
import { forms } from "./forms";
import { glass } from "./glass";
import { typography } from "./typography";

export const tables = {
  wrapper: glass.table,

  shell:
    "mt-6 overflow-hidden rounded-3xl",

  scroll:
    "overflow-x-auto",

  table:
    "w-full min-w-[900px] text-left",

  caption:
    "sr-only",

  head: glass.tableHeader,

  headRow:
    "",

  headerCell:
    "px-4 py-4",

  headerCellRight:
    "px-4 py-4 text-right",

  body:
    "divide-y divide-white/10",

  row: glass.tableRow,

  selectedRow:
    [
      glass.tableRow,
      colors.surfaceStrong,
    ].join(" "),

  cell: glass.tableCell,

  cellStrong:
    [
      "px-4 py-4",
      typography.bodyStrong,
    ].join(" "),

  cellMuted:
    [
      "px-4 py-4",
      typography.bodyMuted,
    ].join(" "),

  cellFaint:
    [
      "px-4 py-4",
      typography.smallMuted,
    ].join(" "),

  cellRight:
    [
      "px-4 py-4 text-right",
      typography.body,
    ].join(" "),

  toolbar:
    "flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between",

  toolbarActions:
    "flex flex-wrap gap-3",

  filterGrid:
    "mt-6 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]",

  field:
    forms.field,

  label:
    forms.label,

  select:
    forms.select,

  input:
    forms.input,

  searchWrap:
    "relative",

  searchIcon:
    [
      "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2",
      colors.textFaint,
    ].join(" "),

  searchInput:
    [
      forms.input,
      "pl-11",
    ].join(" "),

  empty: glass.emptyState,

  loadingState:
    [
      "inline-flex items-center gap-3",
      typography.bodyMuted,
    ].join(" "),

  emptyInline:
    [
      "inline-flex items-center gap-3",
      typography.bodyMuted,
    ].join(" "),

  checkboxButton:
    [
      "inline-flex h-8 w-8 items-center justify-center rounded-xl transition",
      colors.border,
      colors.surfaceInset,
      colors.textSecondary,
      colors.surfaceHover,
    ].join(" "),

  checkboxBox:
    [
      "h-4 w-4 rounded",
      colors.borderStrong,
    ].join(" "),

  badge:
    [
      "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
      colors.neutralBadge,
    ].join(" "),

  actionIcon:
    buttons.icon,

  actionIconDanger:
    buttons.iconDanger,
} as const;

export type TableKey = keyof typeof tables;
