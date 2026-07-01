import type {
  BrightreeReferenceKey,
  BrightreeReferenceRecord,
  BrightreeReferenceSettings,
} from "./settings-types";

function record(
  name: string,
  extra: Omit<BrightreeReferenceRecord, "id" | "name"> = {}
): BrightreeReferenceRecord {
  return {
    id: name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
    name,
    ...extra,
  };
}

export const BRIGHTREE_REFERENCE_GROUPS: Array<{
  key: BrightreeReferenceKey;
  label: string;
  description: string;
  fields: Array<keyof BrightreeReferenceRecord>;
}> = [
  { key: "insuranceGroups", label: "Insurance Groups", description: "Payor group labels used for insurance classification.", fields: ["name"] },
  { key: "practitionerNoteReasons", label: "Practitioner Note Reasons", description: "Reusable note reason values for CPAP and practitioner follow-up workflows.", fields: ["name"] },
  { key: "pickupExchangeReasons", label: "Pickup/Exchange Reasons", description: "Operational reasons used for pickup, exchange, repair, and refusal workflows.", fields: ["name"] },
  { key: "itemGroups", label: "Item Groups", description: "Brightree item group names used by product category dropdowns and imports.", fields: ["name", "itemGroupNo"] },
  { key: "planTypes", label: "Plan Types", description: "Insurance plan type labels for payor and coverage forms.", fields: ["name"] },
  { key: "manufacturers", label: "Manufacturers", description: "Manufacturer names used by product catalog autofill.", fields: ["name"] },
  { key: "insuranceCompanies", label: "Insurance Companies", description: "Insurance company labels and optional descriptions.", fields: ["name", "description"] },
  { key: "paymentReasons", label: "Payment Reasons", description: "Reason and payment type values used by payment/denial workflows.", fields: ["name", "paymentType"] },
];

export const DEFAULT_BRIGHTREE_REFERENCES: BrightreeReferenceSettings = {
  insuranceGroups: [
    "Contracted Payers",
    "Liability Insurance",
    "Medicaid",
    "Medicare",
    "Patient Pay",
    "Private Insurance",
    "Workers Comp",
  ].map((name) => record(name)),

  practitionerNoteReasons: [
    "CPAP 1 MONTH FOLLOW UP",
    "CPAP 12 MONTH FOLLOW UP",
    "CPAP 3 MONTH FOLLOW UP",
    "CPAP 48 HOUR FOLLOW UP",
    "CPAP 6 MO FOLLOW UP",
    "CPAP 9 MONTH FOLLOW UP",
  ].map((name) => record(name)),

  pickupExchangeReasons: [
    "Admitted to Hospice",
    "ADMITTED TO NSG HOME",
    "cannot locate patient",
    "Changed Suppliers",
    "INSURANCE INACTIVE",
    "INSURANCE TERMINATED",
    "NON COMPLIANCE",
    "Patient Deceased",
    "Patient Refused Service",
    "Pickup Order - based on physician",
    "Pickup Req - patient request",
    "Refill Exchange",
    "Repair/Malfunction",
    "Routine Service",
  ].map((name) => record(name)),

  itemGroups: [
    "Aids to Living",
    "Ambulatory Aids",
    "Bathroom Aids",
    "Beds",
    "Beds - Components",
    "Beds - Specialty",
    "Breast Pumps",
    "COMPRESSION HOSE",
    "CPAP/BiLevel",
    "CPAP/BiLevel Supplies",
    "CPM - Equipment",
    "CPM - Supplies",
    "Decubitis Care",
    "Diabetic - Glucose Monitors",
    "Diabetic - Supplies",
    "Enteral - Nutrients",
    "Enteral - Pumps",
    "Enteral - Supplies",
    "HME - Incontinence Products",
    "HME - Misc",
    "HME - Patient Lifts",
    "HME - Walkers",
    "Orthopedics",
    "Oxygen - Concentrators",
    "Oxygen - Consv Devices",
  ].map((name) => record(name)),

  planTypes: [
    "Capitation",
    "FFS",
    "HMO",
    "Mcare Sup",
    "Medicaid",
    "Medicare",
    "Patient",
    "PPO",
  ].map((name) => record(name)),

  manufacturers: [
    "Aeiomed",
    "Aftermarket Group",
    "AG Industries",
    "AirSep",
    "Alimed",
    "Ballard Medical",
    "Batteries Plus",
    "Battle Creek",
    "Beiersdorf-Jobst",
    "Breg",
    "Caire",
    "CARDINAL HEALTHCARE",
    "Chase Ergonomics",
    "CHATTANOOGA",
    "Coloplast-Amoena",
    "Cramer Decker",
    "Dalton",
    "Devilbiss",
    "Drive",
    "Essential",
  ].map((name) => record(name)),

  insuranceCompanies: [
    record("AARP"),
    record("Aetna"),
    record("Blue Cross/Blue Shield"),
    record("Christian Health Center", { description: "Christian Care Communities" }),
    record("Cigna"),
    record("CUMBERLAND HALL"),
    record("United Healthcare"),
  ],

  paymentReasons: [
    "'25-Pmt denied, stop loss met'",
    "04 (Medicare)",
    "1-Deductible Amount",
    "10-Dx Inconsist w/Pt Gender",
    "100-Pmt made to pt/insured",
    "101-Predetermination",
    "102-Major Medical Adjustment",
    "102-Promotional discount",
    "104-Managed care withholding",
    "105-Tax withholding",
    "106-Pt pmt opt/elc not in effect",
    "107-Svc not identified on claim",
    "108-Rent/purch guidelines not met",
    "109-Claim not covered by payer",
    "11-Dx Inconsist w/procedure",
    "110-Billing predates DOS",
    "111-Provider must AA",
    "112-Svc not provided to pt",
    "113-Service pvd outside US",
    "114-Not approved by FDA",
    "115-Procedure postponed",
    "116-Indemnification notice",
    "117-Transport covered to closest facility",
    "118-ESRD network adjustment",
    "119-Benefit max reached",
  ].map((name) => record(name, { paymentType: "Denial" })),
};
