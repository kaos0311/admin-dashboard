import type { NormalizedImportRow } from "./types";
import { makeSafeDocId, normalizeSearchText } from "./utils/normalize";

const MAX_SEARCH_TOKENS = 100;

export type PatientSummaryIndex = {
  id: string;
  patientKey: string;
  patientNameDobKey: string;

  firstName: string;
  lastName: string;
  fullName: string;

  dob: string | null;

  hospiceDetected: boolean;

  searchTokens: string[];

  updatedAtMs: number;
};

export type HcpcsSummaryIndex = {
  id: string;

  hcpcs: string;
  hcpcsKey: string;

  itemName: string;

  quantity: number;

  chargeAmount: number;
  paidAmount: number;
  balanceAmount: number;

  updatedAtMs: number;
};

export type PayorSummaryIndex = {
  id: string;

  payorKey: string;

  primaryPayor: string;
  secondaryPayor: string;

  insuranceType: string;

  chargeAmount: number;
  paidAmount: number;
  balanceAmount: number;

  updatedAtMs: number;
};

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function safeMs(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : Date.now();
}

function safeTokens(tokens: unknown): string[] {
  if (!Array.isArray(tokens)) return [];

  return Array.from(
    new Set(
      tokens
        .map((token) => normalizeSearchText(token))
        .filter(Boolean),
    ),
  ).slice(0, MAX_SEARCH_TOKENS);
}

export function buildPatientSummaryIndex(
  row: NormalizedImportRow,
): PatientSummaryIndex {
  const patientKey = safeString(row.patient?.patientKey, "unknown_patient");

  return {
    id: makeSafeDocId(patientKey),

    patientKey,

    patientNameDobKey: safeString(
      row.index?.patientNameDobKey,
      "unknown_patient",
    ),

    firstName: safeString(row.patient?.firstName),
    lastName: safeString(row.patient?.lastName),
    fullName: safeString(row.patient?.fullName),

    dob: row.patient?.dob ?? null,

    hospiceDetected: row.patient?.hospiceDetected === true,

    searchTokens: safeTokens(row.index?.searchTokens),

    updatedAtMs: safeMs(row.updatedAtMs),
  };
}

export function buildHcpcsSummaryIndex(
  row: NormalizedImportRow,
): HcpcsSummaryIndex {
  const hcpcsKey = safeString(row.item?.hcpcsKey, "unknown_hcpcs");

  return {
    id: makeSafeDocId(hcpcsKey),

    hcpcs: safeString(row.item?.hcpcs, "UNKNOWN"),
    hcpcsKey,

    itemName: safeString(row.item?.itemName, "Unknown Item"),

    quantity: safeNumber(row.item?.quantity),

    chargeAmount: safeNumber(row.financials?.chargeAmount),
    paidAmount: safeNumber(row.financials?.paidAmount),
    balanceAmount: safeNumber(row.financials?.balanceAmount),

    updatedAtMs: safeMs(row.updatedAtMs),
  };
}

export function buildPayorSummaryIndex(
  row: NormalizedImportRow,
): PayorSummaryIndex {
  const payorKey = safeString(row.insurance?.payorKey, "unknown_payor");

  return {
    id: makeSafeDocId(payorKey),

    payorKey,

    primaryPayor: safeString(row.insurance?.primaryPayor, "UNKNOWN"),
    secondaryPayor: safeString(row.insurance?.secondaryPayor, "NONE"),

    insuranceType: safeString(row.insurance?.insuranceType, "UNKNOWN"),

    chargeAmount: safeNumber(row.financials?.chargeAmount),
    paidAmount: safeNumber(row.financials?.paidAmount),
    balanceAmount: safeNumber(row.financials?.balanceAmount),

    updatedAtMs: safeMs(row.updatedAtMs),
  };
}