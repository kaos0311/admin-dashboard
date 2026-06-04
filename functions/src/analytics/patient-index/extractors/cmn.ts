import type {
  CmnSnapshot
} from "../types";

import {
  normalizeIsoDate,
  valueFromAliases
} from "../utils";

export function extractCmn(row: Record<string, unknown>): CmnSnapshot | null {
  const status = valueFromAliases(row, [
    "CMNStatusName",
    "CMN Status",
    "CMNStatus",
  ]);

  const formName = valueFromAliases(row, [
    "CMNFormName",
    "CMN Form",
    "CMN Name",
  ]);

  if (!status && !formName) return null;

  return {
    status,
    formName,
    initialDate: normalizeIsoDate(
      valueFromAliases(row, ["InitialDate", "Initial Date"])
    ),
    expiryDate: normalizeIsoDate(
      valueFromAliases(row, ["ExpiryDate", "Expiry Date", "Expiration Date"])
    ),
    recertDate: normalizeIsoDate(
      valueFromAliases(row, ["RecertDate", "Recert Date"])
    ),
    printedDate: normalizeIsoDate(
      valueFromAliases(row, ["PrintedDate", "Printed Date"])
    ),
    firstCmnName: valueFromAliases(row, ["FirstCMNName", "First CMN Name"]),
    firstCmnInitialDate: normalizeIsoDate(
      valueFromAliases(row, ["FirstCMNInitialDate", "First CMN Initial Date"])
    ),
  };
}
