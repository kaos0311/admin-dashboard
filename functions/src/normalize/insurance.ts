import { getColumnValue } from "../../lib/imports/brightreeColumns";
import type { NormalizedInsurance, RawImportRow } from "../../lib/imports/types";
import { cleanKey, cleanText, normalizePayor } from "./utils";

export function normalizeInsurance(row: RawImportRow): NormalizedInsurance {
  const primaryPayor = normalizePayor(getColumnValue(row, "primaryPayor"));
  const secondaryPayor = normalizePayor(getColumnValue(row, "secondaryPayor"));
  const insuranceType =
    cleanText(getColumnValue(row, "insuranceType")) || "Unknown";

  return {
    primaryPayor,
    secondaryPayor,
    insuranceType,
    payorKey: cleanKey(`${primaryPayor}_${secondaryPayor}_${insuranceType}`),
  };
}