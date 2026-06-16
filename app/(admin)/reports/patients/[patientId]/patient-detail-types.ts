import type { Timestamp } from "firebase/firestore";

export const PATIENTS_COLLECTION = "patients";

export type PatientStatus = "active" | "archived" | "destroyed";
export type PatientTaskStatus = "open" | "done";
export type PatientTaskPriority = "routine" | "watch" | "urgent";

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
  sourceFileName?: string;
};

export type PatientAuthorizationLine = {
  id: string;
  parNumber?: string;
  parKey?: string;
  parStatus?: string;
  parExpiration?: string;
  parInitialDate?: string;
  policyNumber?: string;
  insurance?: string;
  insuranceStatus?: string;
  salesOrderId?: string;
  salesOrderStatus?: string;
  itemId?: string;
  itemName?: string;
  quantity?: number;
  procedureCode?: string;
  modifiers?: string;
  branchOffice?: string;
  actualDeliveryDate?: string;
  nextBillingDate?: string;
  orderingDoctor?: string;
  printedBy?: string;
  printedAt?: string;
  faxedBy?: string;
  faxedAt?: string;
  rowIndex?: number;
};

export type PatientTask = {
  id: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  priority: PatientTaskPriority;
  status: PatientTaskStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string | null;
};

export type PatientRecord = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  patientId?: string;
  dateOfBirth: string;
  dateOfDeath?: string;

  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;

  reportTypes?: string[];
  status: PatientStatus;

  archivedAt?: Timestamp;
  restoredAt?: Timestamp;
  destroyedAt?: Timestamp;

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

  profile?: Record<string, unknown> | null;
  insurance?: Record<string, unknown> | null;
  brightree?: Record<string, unknown> | null;
  cpap?: CpapInfo | null;
  currentEquipment?: CurrentEquipmentItem[];
  currentEquipmentCount?: number;
  purchasesLast90Days?: RecentPurchaseItem[];
  purchasesLast90DaysCount?: number;
  authorizationLines?: PatientAuthorizationLine[];
  authorization?: Record<string, unknown> | null;
  cmn?: Record<string, unknown> | null;
  billing?: Record<string, unknown> | null;
  wip?: Record<string, unknown> | null;
  deliverySummary?: Record<string, unknown> | null;

  hospice?: boolean;
  hospiceStatus?: string;
  tasks?: PatientTask[];
};

export type BirthdayParts = {
  month: number;
  day: number;
  year: number | null;
};




