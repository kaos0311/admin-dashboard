export type PatientStatus = "active" | "archived" | "destroyed";

export type PatientTab =
  | "active"
  | "archived"
  | "destroyEligible"
  | "birthdays"
  | "cpap"
  | "highRisk"
  | "tasks";

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

export type PatientIndex = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
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

  profile?: Record<string, unknown> | null;
  insurance?: Record<string, unknown> | null;
  cpap?: CpapInfo | null;
  currentEquipment?: CurrentEquipmentItem[];
  currentEquipmentCount?: number;
  purchasesLast90Days?: RecentPurchaseItem[];
  purchasesLast90DaysCount?: number;
  authorization?: Record<string, unknown> | null;
  cmn?: Record<string, unknown> | null;
  billing?: Record<string, unknown> | null;
  wip?: Record<string, unknown> | null;
  deliverySummary?: Record<string, unknown> | null;

  hospice?: boolean;
  hospiceStatus?: string;
  tasks?: PatientTask[];
  riskScore?: number;
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
  highRisk: number;
  openTasks: number;
  poorData: number;
};