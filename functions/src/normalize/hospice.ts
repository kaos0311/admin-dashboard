import type { RawImportRow } from "../../lib/imports/types";
import { cleanKey, cleanText, readFirstString } from "./utils";

const HOSPICE_FIELD_KEYS = [
  "Hospice",
  "Hospice Name",
  "Hospice Provider",
  "Hospice Patient",
  "Hospice Status",
  "Hospice Agency",
  "Hospice Company",
  "Hospice Facility",
  "Hospice Indicator",
  "Hospice Flag",
];

const NEGATIVE_VALUES = new Set([
  "",
  "0",
  "false",
  "n",
  "na",
  "n_a",
  "no",
  "none",
  "not_applicable",
  "unknown",
  "null",
  "undefined",
]);

const NEGATIVE_PHRASES = [
  "not hospice",
  "non hospice",
  "not a hospice",
  "no hospice",
  "not on hospice",
  "not currently hospice",
  "not currently on hospice",
  "discharged",
  "revoked",
  "expired",
  "inactive",
  "former hospice",
  "previous hospice",
  "pending",
];

const POSITIVE_VALUES = new Set([
  "1",
  "active",
  "true",
  "y",
  "yes",
  "hospice",
  "on_hospice",
  "currently_on_hospice",
]);

const PROVIDER_HINTS = [
  "hospice",
  "palliative",
  "end of life",
  "end-of-life",
];

export type HospiceDetectionResult = {
  hospiceDetected: boolean;
  hospiceSourceField: string | null;
  hospiceSourceValue: string | null;
};

function isNegativeHospiceValue(value: string): boolean {
  const text = cleanText(value).toLowerCase();
  const key = cleanKey(value);

  if (NEGATIVE_VALUES.has(key)) return true;

  return NEGATIVE_PHRASES.some((phrase) => text.includes(phrase));
}

function isPositiveHospiceValue(value: string): boolean {
  const text = cleanText(value).toLowerCase();
  const key = cleanKey(value);

  if (isNegativeHospiceValue(value)) return false;
  if (POSITIVE_VALUES.has(key)) return true;

  return PROVIDER_HINTS.some((hint) => text.includes(hint));
}

export function detectHospice(row: RawImportRow): HospiceDetectionResult {
  for (const field of HOSPICE_FIELD_KEYS) {
    const value = readFirstString(row, [field]);

    if (!value) continue;

    if (isNegativeHospiceValue(value)) {
      continue;
    }

    if (isPositiveHospiceValue(value)) {
      return {
        hospiceDetected: true,
        hospiceSourceField: field,
        hospiceSourceValue: value,
      };
    }

    /*
     * Provider-style fields are allowed to count as hospice only when they
     * contain a meaningful organization/provider value, not junk like "No",
     * "N/A", or "Pending".
     */
    if (
      field.toLowerCase().includes("provider") ||
      field.toLowerCase().includes("agency") ||
      field.toLowerCase().includes("company") ||
      field.toLowerCase().includes("facility") ||
      field.toLowerCase().includes("name")
    ) {
      return {
        hospiceDetected: true,
        hospiceSourceField: field,
        hospiceSourceValue: value,
      };
    }
  }

  return {
    hospiceDetected: false,
    hospiceSourceField: null,
    hospiceSourceValue: null,
  };
}