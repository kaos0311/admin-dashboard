// functions/src/imports/headerAliases.ts

export const HEADER_ALIASES = {
  patientId: [
    "patient id",
    "patientid",
    "pt id",
    "ptid",
    "pt key",
    "ptkey",
    "customer id",
    "customerid",
    "account number",
    "acct number",
    "acct no",
    "acct #",
    "member id",
    "mrn",
  ],

  patientName: [
    "patient name",
    "pt name",
    "customer name",
    "full name",
    "fullname",
    "name",
    "resident name",
    "beneficiary",
  ],

  firstName: [
    "first name",
    "firstname",
    "patient first name",
    "pt first name",
  ],

  lastName: [
    "last name",
    "lastname",
    "patient last name",
    "pt last name",
  ],

  dob: [
    "dob",
    "date of birth",
    "birth date",
    "birthdate",
    "birthday",
  ],

  phone: [
    "phone",
    "phone number",
    "mobile",
    "cell",
    "home phone",
    "patient phone",
  ],

  address: [
    "address",
    "street",
    "street address",
    "patient address",
    "customer address",
    "service address",
    "ship to",
    "deliver to",
    "bill to",
  ],

  city: [
    "city",
    "patient city",
  ],

  state: [
    "state",
    "patient state",
  ],

  zip: [
    "zip",
    "zipcode",
    "zip code",
    "postal code",
  ],

  insurance: [
    "insurance",
    "primary insurance",
    "payer",
    "payor",
    "insurance name",
    "plan",
  ],

  secondaryInsurance: [
    "secondary insurance",
    "secondary payer",
    "secondary payor",
  ],

  policyNumber: [
    "policy",
    "policy number",
    "policy #",
    "member number",
    "member #",
  ],

  groupNumber: [
    "group",
    "group number",
    "group #",
  ],

  orderNumber: [
    "order",
    "order number",
    "sales order",
    "sales order number",
    "so",
    "ticket",
    "invoice",
  ],

  orderStatus: [
    "status",
    "order status",
    "delivery status",
  ],

  itemName: [
    "item",
    "item name",
    "description",
    "item description",
    "product",
    "product description",
    "equipment",
  ],

  hcpcs: [
    "hcpcs",
    "hcpcs code",
    "procedure code",
    "proc code",
    "hcpc",
  ],

  sku: [
    "sku",
    "item number",
    "item #",
    "inventory id",
    "product id",
  ],

  serialNumber: [
    "serial",
    "serial number",
    "serial #",
    "equipment serial",
  ],

  quantity: [
    "qty",
    "quantity",
    "units",
  ],

  chargeAmount: [
    "charge",
    "charge amount",
    "billed amount",
    "invoice amount",
  ],

  allowedAmount: [
    "allowed",
    "allowed amount",
  ],

  paidAmount: [
    "paid",
    "paid amount",
    "payment",
    "payment amount",
  ],

  balanceAmount: [
    "balance",
    "balance amount",
    "open balance",
    "remaining balance",
  ],
} as const;

export type CanonicalHeader = keyof typeof HEADER_ALIASES;

export function normalizeHeaderName(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\uFEFF/g, "")
    .replace(/[#]/g, " number ")
    .replace(/&/g, " and ")
    .replace(/[_\-./\\]/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_HEADER_LOOKUP: Record<string, CanonicalHeader> =
  Object.fromEntries(
    Object.entries(HEADER_ALIASES).flatMap(([canonical, aliases]) => {
      return [canonical, ...aliases].map((alias) => [
        normalizeHeaderName(alias),
        canonical,
      ]);
    })
  ) as Record<string, CanonicalHeader>;

export function resolveCanonicalHeader(
  header: string
): CanonicalHeader | null {
  const normalized = normalizeHeaderName(header);

  return NORMALIZED_HEADER_LOOKUP[normalized] ?? null;
}

export function isKnownHeader(header: string): boolean {
  return resolveCanonicalHeader(header) !== null;
}

export function getAliasesForHeader(
  header: CanonicalHeader
): readonly string[] {
  return HEADER_ALIASES[header];
}