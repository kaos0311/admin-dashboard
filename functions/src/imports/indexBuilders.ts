import type { NormalizedImportRow } from "./types";

export interface PatientSummaryIndex {
  id: string;
  patientKey: string;
  patientNameDobKey: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dob: string | null;
  hospiceDetected: boolean;
  reportTypes: string[];
  searchTokens: string[];
  updatedAtMs: number;
}

export interface HcpcsSummaryIndex {
  id: string;
  hcpcs: string;
  hcpcsKey: string;
  itemName: string;
  quantity: number;
  chargeAmount: number;
  paidAmount: number;
  balanceAmount: number;
  updatedAtMs: number;
}

export interface PayorSummaryIndex {
  id: string;
  payorKey: string;
  primaryPayor: string;
  secondaryPayor: string;
  insuranceType: string;
  chargeAmount: number;
  paidAmount: number;
  balanceAmount: number;
  updatedAtMs: number;
}

export function buildPatientSummaryIndex(row: NormalizedImportRow): PatientSummaryIndex {
  return {
    id: row.patient.patientKey,
    patientKey: row.patient.patientKey,
    patientNameDobKey: row.index.patientNameDobKey,
    firstName: row.patient.firstName,
    lastName: row.patient.lastName,
    fullName: row.patient.fullName,
    dob: row.patient.dob,
    hospiceDetected: row.patient.hospiceDetected,
    reportTypes: [row.reportType],
    searchTokens: row.index.searchTokens,
    updatedAtMs: row.updatedAtMs,
  };
}

export function buildHcpcsSummaryIndex(row: NormalizedImportRow): HcpcsSummaryIndex {
  return {
    id: row.item.hcpcsKey || "unknown_hcpcs",
    hcpcs: row.item.hcpcs || "UNKNOWN",
    hcpcsKey: row.item.hcpcsKey || "unknown_hcpcs",
    itemName: row.item.itemName,
    quantity: row.item.quantity,
    chargeAmount: row.financials.chargeAmount,
    paidAmount: row.financials.paidAmount,
    balanceAmount: row.financials.balanceAmount,
    updatedAtMs: row.updatedAtMs,
  };
}

export function buildPayorSummaryIndex(row: NormalizedImportRow): PayorSummaryIndex {
  return {
    id: row.insurance.payorKey || "unknown_payor",
    payorKey: row.insurance.payorKey || "unknown_payor",
    primaryPayor: row.insurance.primaryPayor,
    secondaryPayor: row.insurance.secondaryPayor,
    insuranceType: row.insurance.insuranceType,
    chargeAmount: row.financials.chargeAmount,
    paidAmount: row.financials.paidAmount,
    balanceAmount: row.financials.balanceAmount,
    updatedAtMs: row.updatedAtMs,
  };
}