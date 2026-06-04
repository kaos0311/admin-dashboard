import {
  normalizeString,
  valueFromAliases
} from "../utils";

export function rowLooksHospice(
  row: Record<string, unknown>,
  reportType: string
): boolean {
  const normalizedReportType = normalizeString(reportType).toLowerCase();

  const payor = valueFromAliases(row, [
    "payor",
    "payer",
    "payorname",
    "payername",
    "insurance",
    "primaryinsurance",
    "primary_insurance",
    "PrimaryInsuranceName",
    "Insurance",
  ]).toLowerCase();

  const hospiceFlag = valueFromAliases(row, [
    "hospice",
    "is_hospice",
    "ishospice",
    "patientishospice",
  ]).toLowerCase();

  return (
    normalizedReportType.includes("hospice") ||
    payor.includes("hospice") ||
    payor.includes("pennyroyal") ||
    hospiceFlag === "yes" ||
    hospiceFlag === "true" ||
    hospiceFlag === "1"
  );
}
