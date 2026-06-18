import type { Timestamp } from "firebase-admin/firestore";

export type PatientIndexSource = {
  reportId: string;
  reportType: string;
  reportLabel: string;
  fileName: string;
  processedAtIso: string;
};

export type ImportedRowWrapper = {
  rowNumber?: number;
  lineNumber?: number;
  data?: Record<string, unknown>;
  text?: string;
};

export type PatientProfile = {
  patientId: string;
  patientKey: string;
  accountNumber: string;
  sex: string;
  height: string;
  weight: string;
  patientStatus: string;
  patientHubStatus: string;
  registrationDate: string;
  lastLoginDate: string;
  primaryDoctor: string;
  orderingDoctor: string;
  branchOffice: string;
  branchGroup: string;
  parentBranchGroup: string;
  accountGroup: string;
  doctorGroup: string;
  referralName: string;
  referralType: string;
  marketingRep: string;
  practitionerName: string;
  therapyName: string;
  therapyType: string;
  glAccountGroupName: string;
  deliveryCounty: string;
  restrictedAccess: string;
  patientBranch: string;
  acceptAssignment: string;
  diagnosisCodes: string[];
};

export type InsuranceSnapshot = {
  primaryInsurance: string;
  secondaryInsurance: string;
  policyNumber: string;
  insuranceStatus: string;
  coverageTypes: string;
  payor: string;
  payorKey: string;
  insuranceGroup: string;
  insuranceNameWithKey: string;
  acceptAssignment: string;
};

export type CurrentEquipmentItem = {
  id: string;
  itemId: string;
  itemName: string;
  hcpc: string;
  category: string;
  saleType: string;
  qty: number;
  serialNumber: string;
  lotNumber: string;
  status: string;
  startDate: string;
  lastUpdated: string;
  sourceReportId: string;
  sourceFileName: string;
};

export type RecentPurchaseItem = {
  id: string;
  itemId: string;
  itemName: string;
  hcpc: string;
  purchaseDate: string;
  quantity: number;
  amount: number;
  orderId: string;
  sourceReportId: string;
  sourceFileName: string;
};

export type CpapInfo = {
  onRecord: boolean;
  machine: string;
  maskType: string;
  humidifier: string;
  tubing: string;
  filters: string;
  headgear: string;
  pressure: string;
  serialNumber: string;
  setupDate: string;
  lastServiceDate: string;
  complianceStatus: string;
};

export type AuthorizationSnapshot = {
  parNumber: string;
  parStatus: string;
  parExpiration: string;
  parInitialDate: string;
  parLogged: string;
  firstParNumber: string;
  firstParExpiration: string;
};

export type CmnSnapshot = {
  status: string;
  formName: string;
  initialDate: string;
  expiryDate: string;
  recertDate: string;
  printedDate: string;
  firstCmnName: string;
  firstCmnInitialDate: string;
};

export type BillingSnapshot = {
  lastInvoiceDate: string;
  lastPaymentDate: string;
  invoiceCreateDate: string;
  invoiceOpenDate: string;
  invoiceServiceDate: string;
  invoiceDocumentDate: string;
  paymentCreateDate: string;
  paymentPostedDate: string;
  paymentDos: string;
  paymentReason: string;
  saleType: string;
  transactionType: string;
  lastPickupDate: string;
  totalCharges90Days: number;
  totalAllowed90Days: number;
  totalPayments90Days: number;
  totalAdjustments90Days: number;
  openBalanceEstimate: number;
  appliedPayment: number;
  invoiceStatus: string;
};

export type WipSnapshot = {
  status: string;
  daysInState: number;
  assignedTo: string;
  dateNeeded: string;
  completed: boolean;
  primaryInsuranceVerified: boolean;
  secondaryInsuranceVerified: boolean;
  createdBy: string;
};

export type DeliverySummary = {
  salesOrderId: string;
  salesOrderStatus: string;
  actualDeliveryDate: string;
  scheduledDeliveryDate: string;
  deliveryTechName: string;
  csr: string;
  branch: string;
  comments: string;
  hipaaSignatureOnFile: string;
};

export type BirthdayFields = {
  hasBirthday: boolean;
  birthMonth: number;
  birthDay: number;
  birthMonthDay: string;
  age: number | null;
  nextAge: number | null;
  nextBirthday: Timestamp | null;
  nextBirthdayIso: string;
  daysUntilBirthday: number | null;
};

export type BirthdayAnalyticsItem = {
  id: string;
  patientId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  birthMonth: number;
  birthDay: number;
  birthMonthDay: string;
  age: number | null;
  nextAge: number | null;
  nextBirthdayIso: string;
  daysUntilBirthday: number;
  phone: string;
  city: string;
  state: string;
  primaryInsurance: string;
  cpapOnRecord: boolean;
  hospice: boolean;
};

export type PatientRollup = {
  equipment: Map<string, CurrentEquipmentItem>;
  purchases: Map<string, RecentPurchaseItem>;
  cpap: CpapInfo | null;
  authorization: AuthorizationSnapshot | null;
  cmn: CmnSnapshot | null;
  billing: BillingSnapshot | null;
  wip: WipSnapshot | null;
  deliverySummary: DeliverySummary | null;
  profile: PatientProfile | null;
  insurance: InsuranceSnapshot | null;
};









