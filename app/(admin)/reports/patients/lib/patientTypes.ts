export const PATIENTS_COLLECTION = "patients";
export const PATIENT_TIMELINE_SUBCOLLECTION = "timeline";

export type PatientStatus = "active" | "archived" | "destroyed";

export type PatientTab =
  | "active"
  | "archived"
  | "destroyEligible"
  | "birthdays"
  | "cpap"
  | "highRisk"
  | "tasks"
  | "hospice"
  | "wip";

export type SortMode =
  | "nameAsc"
  | "nameDesc"
  | "riskDesc"
  | "birthdayAsc"
  | "lastActivityDesc"
  | "destroyEligibleAsc"
  | "dataQualityAsc";

export type CpapInfo = {
  onRecord?: boolean;
  machine?: string;
  maskType?: string;
  humidifier?: string;
  tubing?: string;
  filters?: string;
  headgear?: string;
  pressure?: string;
  serialNumber?: string;
  setupDate?: string;
  lastServiceDate?: string;
  complianceStatus?: string;
};

export type CurrentEquipmentItem = {
  itemId?: string;
  itemName?: string;
  hcpc?: string;
  category?: string;
  saleType?: string;
  qty?: number;
  serialNumber?: string;
  lotNumber?: string;
  status?: string;
  startDate?: string;
  lastUpdated?: string;
  sourceReportId?: string;
  sourceFileName?: string;
  maintenanceStatus?: string;
  lastMaintenanceDate?: string;
  replacementDueDate?: string;
  warrantyExpiration?: string;
  retrievalStatus?: string;
};

export type RecentPurchaseItem = {
  itemId?: string;
  itemName?: string;
  hcpc?: string;
  purchaseDate?: string;
  quantity?: number;
  amount?: number;
  orderId?: string;
  sourceReportId?: string;
  sourceFileName?: string;
};

export type PatientTaskStatus = "open" | "done";
export type PatientTaskPriority = "routine" | "watch" | "urgent";

export type PatientTask = {
  id: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  priority: PatientTaskPriority;
  status: PatientTaskStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string | null;
};

export type PatientSource = {
  reportId?: string;
  reportType?: string;
  reportLabel?: string;
  fileName?: string;
};

export type PatientProfile = {
  patientId?: string;
  patientKey?: string;
  accountNumber?: string;
  sex?: string;
  height?: string;
  weight?: string;
  patientStatus?: string;
  patientHubStatus?: string;
  registrationDate?: string;
  lastLoginDate?: string;
  primaryDoctor?: string;
  orderingDoctor?: string;
  diagnosisCodes?: string[];
};

export type PatientInsurance = {
  primaryInsurance?: string;
  secondaryInsurance?: string;
  policyNumber?: string;
  insuranceStatus?: string;
  coverageTypes?: string;
  payor?: string;
};

export type PatientAuthorization = {
  parNumber?: string;
  parStatus?: string;
  parExpiration?: string;
  parInitialDate?: string;
  parLogged?: string;
  firstParNumber?: string;
  firstParExpiration?: string;
};

export type PatientCmn = {
  status?: string;
  formName?: string;
  initialDate?: string;
  expiryDate?: string;
  recertDate?: string;
  printedDate?: string;
  firstCmnName?: string;
  firstCmnInitialDate?: string;
};

export type PatientBilling = {
  lastInvoiceDate?: string;
  lastPaymentDate?: string;
  totalCharges90Days?: number;
  totalAllowed90Days?: number;
  totalPayments90Days?: number;
  totalAdjustments90Days?: number;
  openBalanceEstimate?: number;
  invoiceStatus?: string;
};

export type PatientWip = {
  status?: string;
  daysInState?: number;
  assignedTo?: string;
  dateNeeded?: string;
  completed?: boolean;
  primaryInsuranceVerified?: boolean;
  secondaryInsuranceVerified?: boolean;
  createdBy?: string;
};

export type PatientDeliverySummary = {
  salesOrderId?: string;
  salesOrderStatus?: string;
  actualDeliveryDate?: string;
  scheduledDeliveryDate?: string;
  deliveryTechName?: string;
  csr?: string;
  branch?: string;
  comments?: string;
  hipaaSignatureOnFile?: string;
};

export type PatientIndex = {
  id: string;

  firstName: string;
  lastName: string;
  fullName: string;
  normalizedFullName?: string;
  sourceFullName?: string;

  dateOfBirth: string;
  dateOfDeath?: string;
  dob?: string;
  dod?: string;

  hasBirthday?: boolean;
  birthMonth?: number;
  birthDay?: number;
  birthMonthDay?: string;
  age?: number | null;
  nextAge?: number | null;
  nextBirthday?: unknown;
  nextBirthdayIso?: string;
  daysUntilBirthday?: number | null;

  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;

  reportTypes?: string[];
  sources?: PatientSource[];

  status: PatientStatus;

  archivedAt?: unknown;
  restoredAt?: unknown;
  destroyedAt?: unknown;

  lastEquipmentDate?: string;
  lastTreatmentDate?: string;
  lastActivityDate?: string;
  destroyEligibleDate?: string;

  snapshot?: string;
  patientSnapshot?: string;
  notes?: string;
  careNotes?: string;
  equipmentNotes?: string;
  billingNotes?: string;

  profile?: PatientProfile | null;
  insurance?: PatientInsurance | null;
  cpap?: CpapInfo | null;
  currentEquipment?: CurrentEquipmentItem[];
  currentEquipmentCount?: number;
  purchasesLast90Days?: RecentPurchaseItem[];
  purchasesLast90DaysCount?: number;
  authorization?: PatientAuthorization | null;
  cmn?: PatientCmn | null;
  billing?: PatientBilling | null;
  wip?: PatientWip | null;
  deliverySummary?: PatientDeliverySummary | null;

  hospice?: boolean;
  hospiceStatus?: string;

  tasks?: PatientTask[];
  riskScore?: number;
  rowCount?: number;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type PatientWithDerived = PatientIndex & {
  riskScore: number;
  riskFlags: string[];
  openTaskCount: number;
  dataCompletenessScore: number;
  destroyEligibleDateComputed: string;
  lastActivityDateComputed: string;
};

export type BirthdayParts = {
  month: number;
  day: number;
  year: number | null;
};

export type PatientStats = {
  total: number;
  active: number;
  archived: number;
  destroyed: number;
  destroyEligible: number;
  birthdays: number;
  todayBirthdays: number;
  cpap: number;
  equipment: number;
  hospice: number;
  wip: number;
  highRisk: number;
  openTasks: number;
  poorData: number;
};