export type HospiceStatus =
  | "active"
  | "living"
  | "deceased"
  | "discharged"
  | "pending_pickup"
  | "unknown";

export type RiskLevel =
  | "low"
  | "medium"
  | "high";

export type HospiceId = string;

export type HospiceRentalItem = {
  itemId?: string;
  itemName: string;
  itemGroup?: string;
  procCode?: string;
  hcpc?: string;
  modifiers?: string;
  serialNumber?: string;
  salesOrderId?: string;
  salesOrderDetailId?: string;
  originalDos?: string;
  nextDos?: string;
  startDate?: string;
  nextBillingDate?: string;
  quantity?: number;
  status?: string;
};

/**
 * Hospice patient record used by dashboard views,
 * analytics, routing, compliance, and operational reports.
 */
export type HospicePatient = {
  id: HospiceId;

  patientId?: string;
  patientName: string;
  dateOfBirth?: string;
  dateOfDeath?: string;

  status: HospiceStatus;

  hospiceProvider?: string;
  nurseName?: string;
  nursePhone?: string;

  payor?: string;

  nextOfKin?: string;
  phone?: string;
  address?: string;

  equipment: readonly string[];
  rentalItems: readonly HospiceRentalItem[];
  openIssues: readonly string[];

  notes?: string;

  source?: string;
  lastUpdated?: string;

  riskLevel: RiskLevel;
  riskReasons: readonly string[];
};

export type StatusFilter =
  | "all"
  | HospiceStatus;

export type RiskFilter =
  | "all"
  | RiskLevel;

export type SortMode =
  | "nameAsc"
  | "riskDesc"
  | "statusAsc"
  | "updatedDesc";

/**
 * High-level dashboard metrics.
 */
export type HospiceStats = Readonly<{
  total: number;
  active: number;
  deceased: number;
  pendingPickup: number;
  highRisk: number;
  missingNurse: number;
  missingPayor: number;
}>;

export type MemorialPatient = Readonly<{
  id: HospiceId;
  patientName: string;
  dateOfBirth: string;
  dateOfDeath: string;
  deathTime: number;
}>;


