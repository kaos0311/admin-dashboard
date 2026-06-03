import type {
  CurrentEquipmentItem,
  PatientRollup,
  RecentPurchaseItem
} from "../types";

export function createEmptyRollup(): PatientRollup {
  return {
    equipment: new Map<string, CurrentEquipmentItem>(),
    purchases: new Map<string, RecentPurchaseItem>(),
    cpap: null,
    authorization: null,
    cmn: null,
    billing: null,
    wip: null,
    deliverySummary: null,
    profile: null,
    insurance: null,
  };
}
