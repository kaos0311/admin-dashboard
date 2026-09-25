import type { RowIssue } from "../../types/processorResult";

export type PatientContactSnapshot = {
  relationship?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  address1?: string;
};

export type PatientInsuranceSnapshot = {
  primaryInsurance?: string;
  primaryPolicyNumber?: string;
  primaryGroupNumber?: string;
  secondaryInsurance?: string;
  secondaryPolicyNumber?: string;
  secondaryGroupNumber?: string;
  policyNumber?: string;
  groupNumber?: string;
  payor?: string;
};

export type PatientNormalized = {
  sourceRowId: string;
  rowIndex: number;
  patientKey: string;
  patientId?: string;
  patientName: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  dateOfDeath?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  insuranceName?: string;
  customerType?: string;
  facility?: string;
  nursingAgency?: string;
  emergencyContact?: PatientContactSnapshot;
  responsibleParty?: PatientContactSnapshot;
  insurance?: PatientInsuranceSnapshot;
  primaryDoctor?: string;
  orderingDoctor?: string;
  referralName?: string;
  referralType?: string;
  searchText: string;
  hospiceMarked: boolean;
  issues: RowIssue[];
  raw: Record<string, unknown>;
};

export type PatientAggregate = PatientNormalized & {
  importIds: string[];
  sourceRowIds: string[];
  lastImportId: string;
  duplicateCount: number;
};
