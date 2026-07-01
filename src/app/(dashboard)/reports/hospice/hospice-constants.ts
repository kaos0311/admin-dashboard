import type { RiskFilter, SortMode, StatusFilter } from "./hospice-types";

type FilterOption<TValue extends string> = {
  readonly label: string;
  readonly value: TValue;
};

export const STATUS_OPTIONS = [
  { label: "All Statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "Living", value: "living" },
  { label: "Discharged", value: "discharged" },
  { label: "Pending Pickup", value: "pending_pickup" },
  { label: "Unknown", value: "unknown" },
] as const satisfies readonly FilterOption<StatusFilter>[];

export const RISK_OPTIONS = [
  { label: "All Risk", value: "all" },
  { label: "High Risk", value: "high" },
  { label: "Medium Risk", value: "medium" },
  { label: "Low Risk", value: "low" },
] as const satisfies readonly FilterOption<RiskFilter>[];

export const SORT_OPTIONS = [
  { label: "Name A-Z", value: "nameAsc" },
  { label: "Highest Risk", value: "riskDesc" },
  { label: "Status", value: "statusAsc" },
  { label: "Recently Updated", value: "updatedDesc" },
] as const satisfies readonly FilterOption<SortMode>[];


