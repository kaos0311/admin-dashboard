export type RawImportRow = Record<string, unknown>;

export type ReportType =
  | "patients"
  | "sales_orders"
  | "sales_order_details"
  | "sales_order_detail_lines"
  | "invoice_details"
  | "payments"
  | "unknown";

export interface NormalizedPatientIdentity {
  patientId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  dob: string | null;
  dobKey: string | null;
  nameKey: string;
  patientKey: string;
  hospiceDetected: boolean;
}

export interface NormalizedFinancials {
  chargeAmount: number;
  allowedAmount: number;
  paidAmount: number;
  balanceAmount: number;
}

export interface NormalizedInsurance {
  primaryPayor: string;
  secondaryPayor: string;
  payorKey: string;
  insuranceType: string;
}

export interface NormalizedItem {
  itemName: string;
  itemKey: string;
  hcpcs: string;
  hcpcsKey: string;
  sku: string;
  serialNumber: string;
  quantity: number;
}

export interface ImportFingerprint {
  sourceRowHash: string;
  duplicateKey: string;
}

export interface FirestoreIndexFields {
  searchTokens: string[];
  patientSearchKey: string;
  patientNameDobKey: string;
  hcpcsKey: string;
  payorKey: string;
  reportType: ReportType;
  importedAtMs: number;
}

export interface NormalizedImportRow {
  id: string;
  reportType: ReportType;
  sourceFileId: string;
  sourceFileName: string;
  sourceRowNumber: number;

  patient: NormalizedPatientIdentity;
  financials: NormalizedFinancials;
  insurance: NormalizedInsurance;
  item: NormalizedItem;
  fingerprint: ImportFingerprint;
  index: FirestoreIndexFields;

  raw: RawImportRow;
  createdAtMs: number;
  updatedAtMs: number;
}