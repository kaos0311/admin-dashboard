type RawImportRow = Record<string, unknown>;

const COLUMN_ALIASES = {
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
    "patient account number",
    "member id",
    "mrn",
  ],

  firstName: [
    "first name",
    "firstname",
    "patient first name",
    "pt first name",
    "customer first name",
  ],

  lastName: [
    "last name",
    "lastname",
    "patient last name",
    "pt last name",
    "customer last name",
  ],

  fullName: [
    "patient name",
    "name",
    "customer name",
    "full name",
    "fullname",
    "pt name",
    "member name",
    "beneficiary",
    "resident name",
  ],

  dob: [
    "dob",
    "date of birth",
    "birth date",
    "birthdate",
    "birthday",
    "patient dob",
  ],

  hcpcs: [
    "hcpcs",
    "hcpcs code",
    "hcpc",
    "proc code",
    "procedure code",
    "procedure",
  ],

  itemName: [
    "item",
    "item name",
    "description",
    "item description",
    "product",
    "product description",
    "product name",
    "equipment",
    "equipment name",
  ],

  sku: [
    "sku",
    "item number",
    "item #",
    "item no",
    "product id",
    "inventory id",
    "inventory number",
  ],

  serialNumber: [
    "serial",
    "serial number",
    "serial #",
    "serial no",
    "equipment serial",
  ],

  quantity: [
    "qty",
    "quantity",
    "units",
    "unit count",
  ],

  chargeAmount: [
    "charge",
    "charge amount",
    "billed amount",
    "amount billed",
    "invoice amount",
    "total charge",
  ],

  allowedAmount: [
    "allowed",
    "allowed amount",
    "insurance allowed",
    "allowable",
  ],

  paidAmount: [
    "paid",
    "paid amount",
    "payment",
    "payment amount",
    "amount paid",
  ],

  balanceAmount: [
    "balance",
    "balance amount",
    "remaining balance",
    "open balance",
    "current balance",
  ],

  primaryPayor: [
    "primary insurance",
    "primary payor",
    "primary payer",
    "payer",
    "payor",
    "insurance",
    "insurance name",
    "plan",
  ],

  secondaryPayor: [
    "secondary insurance",
    "secondary payor",
    "secondary payer",
  ],

  insuranceType: [
    "insurance type",
    "payer type",
    "payor type",
    "plan type",
  ],
} as const;

export type CanonicalColumn = keyof typeof COLUMN_ALIASES;
export type ColumnAliasMap = typeof COLUMN_ALIASES;

const NORMALIZED_ALIAS_MAP: Record<CanonicalColumn, Set<string>> =
  Object.fromEntries(
    Object.entries(COLUMN_ALIASES).map(([column, aliases]) => [
      column,
      new Set([column, ...aliases].map(normalizeColumnName)),
    ])
  ) as Record<CanonicalColumn, Set<string>>;

function normalizeColumnName(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\*/g, "")
    .replace(/#/g, " number ")
    .replace(/&/g, " and ")
    .replace(/[_\-./\\]/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCellValue(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildNormalizedRowMap(row: RawImportRow | null | undefined): Map<string, unknown> {
  const normalizedMap = new Map<string, unknown>();

  if (!row) return normalizedMap;

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeColumnName(key);

    if (!normalizedKey) continue;

    normalizedMap.set(normalizedKey, value);
  }

  return normalizedMap;
}

export function getColumnValue(
  row: RawImportRow | null | undefined,
  column: CanonicalColumn
): string {
  const aliases = NORMALIZED_ALIAS_MAP[column];
  const normalizedMap = buildNormalizedRowMap(row);

  for (const alias of aliases) {
    const match = normalizedMap.get(alias);

    if (match !== undefined && match !== null) {
      return cleanCellValue(match);
    }
  }

  return "";
}

export function getColumnValues(
  row: RawImportRow | null | undefined,
  columns: CanonicalColumn[]
): Partial<Record<CanonicalColumn, string>> {
  const normalizedMap = buildNormalizedRowMap(row);
  const result: Partial<Record<CanonicalColumn, string>> = {};

  for (const column of columns) {
    const aliases = NORMALIZED_ALIAS_MAP[column];

    for (const alias of aliases) {
      const match = normalizedMap.get(alias);

      if (match !== undefined && match !== null) {
        result[column] = cleanCellValue(match);
        break;
      }
    }

    if (!(column in result)) {
      result[column] = "";
    }
  }

  return result;
}

export function hasColumnValue(
  row: RawImportRow | null | undefined,
  column: CanonicalColumn
): boolean {
  return getColumnValue(row, column).length > 0;
}

export function getKnownColumnAliases(): ColumnAliasMap {
  return COLUMN_ALIASES;
}

export function getNormalizedColumnNames(
  row: RawImportRow | null | undefined
): string[] {
  return Array.from(buildNormalizedRowMap(row).keys());
}

export function findMatchingCanonicalColumns(
  rawColumnName: string
): CanonicalColumn[] {
  const normalized = normalizeColumnName(rawColumnName);

  if (!normalized) return [];

  return (Object.keys(NORMALIZED_ALIAS_MAP) as CanonicalColumn[]).filter(
    (column) => NORMALIZED_ALIAS_MAP[column].has(normalized)
  );
}