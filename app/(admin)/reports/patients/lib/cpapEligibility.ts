import type { CurrentEquipmentItem, PatientWithDerived } from "./patientTypes";

export type CpapSupplyRule = {
  id: string;
  label: string;
  hcpcs: string[];
  keywords: string[];
  intervalMonths: number;
  standardQuantity: number;
  medicareThreeMonthQuantity: number;
  description: string;
};

export type CpapEligibilityRow = {
  rule: CpapSupplyRule;
  lastReceivedDate: string;
  nextEligibleDate: string;
  status: "ready" | "soon" | "future" | "missing";
  daysUntilEligible: number | null;
  matchingItems: CurrentEquipmentItem[];
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MASK_RULE_IDS = new Set(["nasal-mask", "full-face-mask"]);

export const CPAP_SUPPLY_RULES: CpapSupplyRule[] = [
  {
    id: "pap-machine",
    label: "CPAP / BIPAP Machine",
    hcpcs: ["E0601", "E0470", "E0471", "E0472"],
    keywords: ["cpap machine", "bipap", "pap machine"],
    intervalMonths: 60,
    standardQuantity: 1,
    medicareThreeMonthQuantity: 1,
    description: "1 every 5 years",
  },
  {
    id: "heated-humidifier",
    label: "Heated Humidifier",
    hcpcs: ["E0562"],
    keywords: ["heated humidifier", "humidifier"],
    intervalMonths: 6,
    standardQuantity: 1,
    medicareThreeMonthQuantity: 1,
    description: "1 every 6 months",
  },
  {
    id: "headgear",
    label: "Head Gear",
    hcpcs: ["A7035"],
    keywords: ["headgear", "head gear"],
    intervalMonths: 6,
    standardQuantity: 1,
    medicareThreeMonthQuantity: 1,
    description: "1 every 6 months",
  },
  {
    id: "chinstrap",
    label: "Chin Strap",
    hcpcs: ["A7036"],
    keywords: ["chinstrap", "chin strap"],
    intervalMonths: 6,
    standardQuantity: 1,
    medicareThreeMonthQuantity: 1,
    description: "1 every 6 months",
  },
  {
    id: "reusable-filter",
    label: "Reusable Filters",
    hcpcs: ["A7039"],
    keywords: ["reusable filter", "non-disposable filter"],
    intervalMonths: 6,
    standardQuantity: 1,
    medicareThreeMonthQuantity: 1,
    description: "1 every 6 months",
  },
  {
    id: "nasal-mask",
    label: "Nasal Mask",
    hcpcs: ["A7034"],
    keywords: ["nasal mask", "mask, cpap, nasal"],
    intervalMonths: 3,
    standardQuantity: 1,
    medicareThreeMonthQuantity: 1,
    description: "1 every 3 months",
  },
  {
    id: "full-face-mask",
    label: "Full Face Mask",
    hcpcs: ["A7030"],
    keywords: ["full face mask"],
    intervalMonths: 3,
    standardQuantity: 1,
    medicareThreeMonthQuantity: 1,
    description: "1 every 3 months",
  },
  {
    id: "tubing",
    label: "Tubing",
    hcpcs: ["A7037", "A4604"],
    keywords: ["tubing", "heated tubing"],
    intervalMonths: 3,
    standardQuantity: 1,
    medicareThreeMonthQuantity: 1,
    description: "1 every 3 months",
  },
  {
    id: "disposable-filter",
    label: "White Filters",
    hcpcs: ["A7038"],
    keywords: ["white filter", "disposable filter"],
    intervalMonths: 1,
    standardQuantity: 1,
    medicareThreeMonthQuantity: 3,
    description: "1 every month",
  },
  {
    id: "full-face-cushion",
    label: "Full Face Cushions",
    hcpcs: ["A7031"],
    keywords: ["full face cushion", "cushion, full face"],
    intervalMonths: 1,
    standardQuantity: 1,
    medicareThreeMonthQuantity: 3,
    description: "1 every month",
  },
  {
    id: "nasal-cushion",
    label: "Nasal Cushions",
    hcpcs: ["A7032"],
    keywords: ["nasal cushion", "cushion, nasal"],
    intervalMonths: 1,
    standardQuantity: 1,
    medicareThreeMonthQuantity: 3,
    description: "1 every month",
  },
  {
    id: "nasal-pillows",
    label: "Pillows",
    hcpcs: ["A7033"],
    keywords: ["nasal pillow", "pillows"],
    intervalMonths: 1,
    standardQuantity: 1,
    medicareThreeMonthQuantity: 3,
    description: "1 every month",
  },
];

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonths(value: Date, months: number): Date {
  const next = new Date(value);
  next.setMonth(next.getMonth() + months);
  return next;
}

function daysBetween(start: Date, end: Date): number {
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.ceil((endDay - startDay) / MS_PER_DAY);
}

function equipmentDate(item: CurrentEquipmentItem): Date | null {
  return (
    parseDate(item.lastUpdated) ||
    parseDate(item.startDate) ||
    parseDate(item.replacementDueDate)
  );
}

function equipmentMatchesRule(item: CurrentEquipmentItem, rule: CpapSupplyRule): boolean {
  const hcpc = String(item.hcpc || item.itemId || "").toUpperCase();
  const name = String(item.itemName || "").toLowerCase();

  return (
    rule.hcpcs.some((code) => code.toUpperCase() === hcpc) ||
    rule.keywords.some((keyword) => name.includes(keyword))
  );
}

function latestMaskRuleId(equipment: CurrentEquipmentItem[]): string | null {
  const maskCandidates = CPAP_SUPPLY_RULES.filter((rule) => MASK_RULE_IDS.has(rule.id))
    .flatMap((rule) =>
      equipment
        .filter((item) => equipmentMatchesRule(item, rule))
        .map((item) => ({
          ruleId: rule.id,
          date: equipmentDate(item),
        })),
    )
    .filter((candidate): candidate is { ruleId: string; date: Date } =>
      Boolean(candidate.date),
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return maskCandidates[0]?.ruleId ?? null;
}

export function isMedicarePatient(patient: Pick<PatientWithDerived, "insurance">): boolean {
  const insurance = [
    patient.insurance?.primaryInsurance,
    patient.insurance?.secondaryInsurance,
    patient.insurance?.payor,
    patient.insurance?.coverageTypes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return insurance.includes("medicare");
}

export function getCpapEligibility(
  patient: Pick<PatientWithDerived, "currentEquipment" | "insurance">,
  today = new Date(),
): CpapEligibilityRow[] {
  const equipment = patient.currentEquipment ?? [];
  const activeMaskRuleId = latestMaskRuleId(equipment);

  return CPAP_SUPPLY_RULES.flatMap<CpapEligibilityRow>((rule) => {
    if (activeMaskRuleId && MASK_RULE_IDS.has(rule.id) && rule.id !== activeMaskRuleId) {
      return [];
    }

    const matchingItems = equipment.filter((item) => equipmentMatchesRule(item, rule));
    const lastDate = matchingItems
      .map(equipmentDate)
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    if (!lastDate) {
      return [{
        rule,
        lastReceivedDate: "",
        nextEligibleDate: "",
        status: "missing",
        daysUntilEligible: null,
        matchingItems,
      }];
    }

    const nextEligible = addMonths(lastDate, rule.intervalMonths);
    const daysUntilEligible = daysBetween(today, nextEligible);
    const status =
      daysUntilEligible <= 0 ? "ready" : daysUntilEligible <= 30 ? "soon" : "future";

    return [{
      rule,
      lastReceivedDate: toIsoDate(lastDate),
      nextEligibleDate: toIsoDate(nextEligible),
      status,
      daysUntilEligible,
      matchingItems,
    }];
  });
}

export function getCpapReadyRows(
  patient: PatientWithDerived,
  today = new Date(),
): CpapEligibilityRow[] {
  return getCpapEligibility(patient, today).filter((row) =>
    row.status === "ready" || row.status === "soon" || row.status === "missing"
  );
}

export function hasCpapEquipment(patient: Pick<PatientWithDerived, "cpap" | "currentEquipment">): boolean {
  return Boolean(
    patient.cpap?.onRecord ||
      (patient.currentEquipment ?? []).some((item) =>
        CPAP_SUPPLY_RULES.some((rule) => equipmentMatchesRule(item, rule))
      )
  );
}
