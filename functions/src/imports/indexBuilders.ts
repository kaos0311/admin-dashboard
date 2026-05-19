import type {
  NormalizedImportRow,
} from "./types";

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

export function buildPatientSummaryIndex(
  row: NormalizedImportRow
): PatientSummaryIndex {
  return {
    id:
      row.patient?.patientKey ??
      "unknown_patient",

    patientKey:
      row.patient?.patientKey ??
      "unknown_patient",

    patientNameDobKey:
      row.index.patientNameDobKey ??
      "unknown_patient",

    firstName:
      row.patient?.firstName ??
      "",

    lastName:
      row.patient?.lastName ??
      "",

    fullName:
      row.patient?.fullName ??
      "",

    dob:
      row.patient?.dob ??
      null,

    hospiceDetected:
      row.patient?.hospiceDetected ??
      false,

    searchTokens:
      row.index.searchTokens ??
      [],

    updatedAtMs:
      row.updatedAtMs ??
      Date.now(),
  };
}

export function buildHcpcsSummaryIndex(
  row: NormalizedImportRow
): HcpcsSummaryIndex {
  return {
    id:
      row.item?.hcpcsKey ??
      "unknown_hcpcs",

    hcpcs:
      row.item?.hcpcs ??
      "UNKNOWN",

    hcpcsKey:
      row.item?.hcpcsKey ??
      "unknown_hcpcs",

    itemName:
      row.item?.itemName ??
      "Unknown Item",

    quantity:
      row.item?.quantity ??
      0,

    chargeAmount:
      row.financials?.chargeAmount ??
      0,

    paidAmount:
      row.financials?.paidAmount ??
      0,

    balanceAmount:
      row.financials?.balanceAmount ??
      0,

    updatedAtMs:
      row.updatedAtMs ??
      Date.now(),
  };
}

export function buildPayorSummaryIndex(
  row: NormalizedImportRow
): PayorSummaryIndex {
  return {
    id:
      row.insurance?.payorKey ??
      "unknown_payor",

    payorKey:
      row.insurance?.payorKey ??
      "unknown_payor",

    primaryPayor:
      row.insurance?.primaryPayor ??
      "UNKNOWN",

    secondaryPayor:
      row.insurance?.secondaryPayor ??
      "NONE",

    insuranceType:
      row.insurance?.insuranceType ??
      "UNKNOWN",

    chargeAmount:
      row.financials?.chargeAmount ??
      0,

    paidAmount:
      row.financials?.paidAmount ??
      0,

    balanceAmount:
      row.financials?.balanceAmount ??
      0,

    updatedAtMs:
      row.updatedAtMs ??
      Date.now(),
  };
}