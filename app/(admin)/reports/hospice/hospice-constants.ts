import type { RiskFilter, SortMode, StatusFilter } from "./hospice-types";

export const STATUS_OPTIONS: Array<{ label: string; value: StatusFilter }> = [
  { label: "All Statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "Living", value: "living" },
  { label: "Deceased", value: "deceased" },
  { label: "Discharged", value: "discharged" },
  { label: "Pending Pickup", value: "pending_pickup" },
  { label: "Unknown", value: "unknown" },
];

export const RISK_OPTIONS: Array<{ label: string; value: RiskFilter }> = [
  { label: "All Risk", value: "all" },
  { label: "High Risk", value: "high" },
  { label: "Medium Risk", value: "medium" },
  { label: "Low Risk", value: "low" },
];

export const SORT_OPTIONS: Array<{ label: string; value: SortMode }> = [
  { label: "Name A-Z", value: "nameAsc" },
  { label: "Highest Risk", value: "riskDesc" },
  { label: "Status", value: "statusAsc" },
  { label: "Recently Updated", value: "updatedDesc" },
];