export type RawImportRow = Record<string, unknown>;

export type ReportType =
  | "patients"
  | "hospice"
  | "insurance"
  | "orders"
  | "orderDetails"
  | "invoiceDetails"
  | "payments"
  | "unknown";

export type FirestoreIndexFields = {
  reportType: ReportType;
  importedAtMs: number;

  patientKey?: string | null;
  patientName?: string | null;
  patientNameDobKey: string;
  patientSearchKey: string;

  firstName?: string | null;
  lastName?: string | null;

  dob?: string | null;
  dobKey?: string | null;

  phone?: string | null;

  hospiceName?: string | null;
  hospiceDetected?: boolean | null;
  hospiceSourceField?: string | null;
  hospiceSourceValue?: string | null;

  insuranceName?: string | null;
  payorKey: string | null;

  orderNumber?: string | null;
  invoiceNumber?: string | null;

  hcpcsKey: string | null;

  searchTokens: string[];
};

export type ImportFingerprint = {
  sourceFileId?: string | null;
  sourceFileName?: string | null;

  reportType?: ReportType;

  rowHash?: string | null;
  sourceRowHash: string;

  duplicateKey: string;
};

export type HospiceDetectionResult = {
  hospiceDetected: boolean;
  hospiceSourceField: string | null;
  hospiceSourceValue: string | null;
};

export type NormalizedPatientIdentity = {
  patientId: string | null;

  patientKey: string;

  firstName: string;
  lastName: string;
  fullName: string;

  nameKey: string;

  dob: string | null;
  dobKey: string;

  phone: string | null;

  hospiceDetected: boolean;
  hospiceSourceField?: string | null;
  hospiceSourceValue?: string | null;
};

export type NormalizedInsurance = {
  payorKey: string;

  primaryPayor: string;
  secondaryPayor: string;

  insuranceType: string;

  payerName?: string | null;

  policyNumber?: string | null;
  groupNumber?: string | null;
};

export type NormalizedFinancials = {
  chargeAmount: number;
  allowedAmount: number;
  paidAmount: number;
  balanceAmount: number;
};

export type NormalizedItem = {
  itemKey: string;

  sku: string;

  hcpcs: string;
  hcpcsKey: string;

  itemName: string;
  description?: string | null;

  serialNumber: string;

  quantity: number;
};

export type NormalizedImportRow = {
  id: string;

  importId?: string;

  sourceFileId: string;
  sourceFileName: string;
  sourceRowNumber: number;

  rowNumber?: number;

  reportType: ReportType;

  raw: RawImportRow;

  index: FirestoreIndexFields;

  fingerprint: ImportFingerprint;

  patient: NormalizedPatientIdentity;
  insurance: NormalizedInsurance;
  financials: NormalizedFinancials;
  item: NormalizedItem;

  createdAtMs: number;
  updatedAtMs: number;
};