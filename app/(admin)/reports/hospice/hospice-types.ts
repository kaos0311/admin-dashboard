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

/**
 * Hospice patient record used by dashboard views,
 * analytics, routing, compliance, and operational reports.
 */
export type HospicePatient = {
  id: HospiceId;

  patientId?: string;
  patientName: string;
  dateOfBirth?: string;

  status: HospiceStatus;

  hospiceProvider?: string;
  nurseName?: string;
  nursePhone?: string;

  payor?: string;

  nextOfKin?: string;
  phone?: string;
  address?: string;

  equipment: readonly string[];
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


