import type {
  AuthorizationSnapshot
} from "../types";

import {
  normalizeIsoDate,
  valueFromAliases
} from "../utils";

export function extractAuthorization(row: Record<string, unknown>): AuthorizationSnapshot | null {
  const parNumber = valueFromAliases(row, [
    "PARNumber",
    "PAR Number",
    "FirstPARNumber",
  ]);

  const parStatus = valueFromAliases(row, [
    "parstatus",
    "PARStatus",
    "PAR Status",
  ]);

  if (!parNumber && !parStatus) return null;

  return {
    parNumber,
    parStatus,
    parExpiration: normalizeIsoDate(
      valueFromAliases(row, ["PARExpiration", "PAR Expiration", "PARExpDate"])
    ),
    parInitialDate: normalizeIsoDate(
      valueFromAliases(row, ["PARInitialDate", "PAR Initial Date"])
    ),
    parLogged: valueFromAliases(row, ["PARLogged", "PAR Logged"]),
    firstParNumber: valueFromAliases(row, ["FirstPARNumber", "First PAR Number"]),
    firstParExpiration: normalizeIsoDate(
      valueFromAliases(row, ["FirstPARExpDate", "First PAR Exp Date"])
    ),
  };
}
