import { glass } from "./glass";

export const tables = {
  wrapper: glass.table,

  head: glass.tableHeader,

  row: glass.tableRow,

  cell: glass.tableCell,

  empty: glass.emptyState,
} as const;

export type TableKey = keyof typeof tables;
