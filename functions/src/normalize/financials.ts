import { getColumnValue } from "../../lib/imports/brightreeColumns";
import type { NormalizedFinancials, RawImportRow } from "../../lib/imports/types";
import { parseMoney } from "./utils";

export function normalizeFinancials(row: RawImportRow): NormalizedFinancials {
  return {
    chargeAmount: parseMoney(getColumnValue(row, "chargeAmount")),
    allowedAmount: parseMoney(getColumnValue(row, "allowedAmount")),
    paidAmount: parseMoney(getColumnValue(row, "paidAmount")),
    balanceAmount: parseMoney(getColumnValue(row, "balanceAmount")),
  };
}