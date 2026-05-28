export type HospiceStatus =
  | "active"
  | "living"
  | "deceased"
  | "discharged"
  | "pending_pickup"
  | "unknown";

export type RiskLevel = "low" | "medium" | "high";

export type HospicePatient = {
  id: string;
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
  equipment: string[];
  openIssues: string[];
  notes?: string;
  source?: string;
  lastUpdated?: string;
  riskLevel: RiskLevel;
  riskReasons: string[];
};

export type StatusFilter = "all" | HospiceStatus;
export type RiskFilter = "all" | RiskLevel;
export type SortMode = "nameAsc" | "riskDesc" | "statusAsc" | "updatedDesc";

export type HospiceStats = {
  total: number;
  active: number;
  deceased: number;
  pendingPickup: number;
  highRisk: number;
  missingNurse: number;
  missingPayor: number;
};