export const IMPORT_RETENTION_MONTHS = 18;
export const PATIENT_DIGITAL_RECORD_RETENTION_MONTHS = 60;

const OPERATIONAL_DATE_FIELDS = [
  "serviceDate",
  "Service Date",
  "DOS",
  "OriginalDOS",
  "NextDOS",
  "Order Date",
  "Created Date",
  "CreateDate",
  "Date",
  "Delivery Date",
  "ActualDeliveryDate",
  "SchedDeliveryDate",
  "SalesOrderActDeliveryDt",
  "SalesOrderNextBillingDt",
  "Invoice Date",
  "InvoiceDate",
  "TransactionDate",
  "GLDate",
  "StartDt",
  "EndDt",
  "DtSold",
  "PARExpiration",
  "PARExpDate",
  "FirstPARExpDate",
  "PARInitialDate",
  "InitialDt",
  "CMNDate",
  "CMNExpDate",
  "CMNInitialDate",
  "WIPDateNeeded",
] as const;

const EXCLUDED_DATE_KEY_PARTS = [
  "birth",
  "dob",
  "death",
  "dod",
];

export type ImportRetentionDecision = {
  keep: boolean;
  matchedField: string;
  matchedDate: Date | null;
  hasOperationalDate: boolean;
};

type ImportRetentionOptions = {
  retentionMonths?: number;
};

type ImportRetentionScope = {
  detectedKind?: string;
  reportType?: string;
  processor?: string;
  processors?: string[];
};

const PATIENT_DIGITAL_RECORD_KINDS = new Set([
  "patient_profile_enrichment",
  "patient_demographics",
  "patient_contact",
  "patient_physicians",
  "patient_referrals",
  "hospice_clinical_status",
  "par_report",
]);

const PATIENT_DIGITAL_RECORD_REPORT_TYPES = new Set([
  "patients",
  "demographics",
  "hospice",
  "hospice_patients",
  "par_report",
]);

export function getImportRetentionMonths(
  options: ImportRetentionOptions = {}
): number {
  return options.retentionMonths ?? IMPORT_RETENTION_MONTHS;
}

export function getImportRetentionMonthsForScope(
  scope: ImportRetentionScope
): number {
  const processors = new Set(
    (scope.processors ?? []).map((value) => String(value).trim().toLowerCase())
  );
  const detectedKind = String(scope.detectedKind ?? "")
    .trim()
    .toLowerCase();
  const reportType = String(scope.reportType ?? "")
    .trim()
    .toLowerCase();
  const processor = String(scope.processor ?? "")
    .trim()
    .toLowerCase();

  if (PATIENT_DIGITAL_RECORD_KINDS.has(detectedKind)) {
    return PATIENT_DIGITAL_RECORD_RETENTION_MONTHS;
  }

  if (PATIENT_DIGITAL_RECORD_REPORT_TYPES.has(reportType)) {
    return PATIENT_DIGITAL_RECORD_RETENTION_MONTHS;
  }

  if (processor === "patients" || processor === "hospice") {
    return PATIENT_DIGITAL_RECORD_RETENTION_MONTHS;
  }

  if (processors.has("patients") || processors.has("hospice")) {
    return PATIENT_DIGITAL_RECORD_RETENTION_MONTHS;
  }

  return IMPORT_RETENTION_MONTHS;
}

export function getImportRetentionCutoff(
  now = new Date(),
  options: ImportRetentionOptions = {}
): Date {
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setMonth(cutoff.getMonth() - getImportRetentionMonths(options));
  return cutoff;
}

export function getImportRetentionCutoffIso(
  now = new Date(),
  options: ImportRetentionOptions = {}
): string {
  return getImportRetentionCutoff(now, options).toISOString().slice(0, 10);
}

export function getImportRetentionMetadata(
  row: Record<string, unknown>,
  now = new Date(),
  options: ImportRetentionOptions = {}
): ImportRetentionDecision {
  const cutoff = getImportRetentionCutoff(now, options);
  const candidates = collectOperationalDateCandidates(row);

  if (candidates.length === 0) {
    return {
      keep: true,
      matchedField: "",
      matchedDate: null,
      hasOperationalDate: false,
    };
  }

  const newest = candidates
    .map((candidate) => ({
      ...candidate,
      date: parseImportDate(candidate.value),
    }))
    .filter(
      (candidate): candidate is { field: string; value: unknown; date: Date } =>
        candidate.date !== null
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

  if (!newest) {
    return {
      keep: true,
      matchedField: "",
      matchedDate: null,
      hasOperationalDate: false,
    };
  }

  return {
    keep: newest.date >= cutoff,
    matchedField: newest.field,
    matchedDate: newest.date,
    hasOperationalDate: true,
  };
}

export function filterRowsToImportRetentionWindow<T extends Record<string, unknown>>(
  rows: T[],
  now = new Date(),
  options: ImportRetentionOptions = {}
): T[] {
  return rows.filter((row) => getImportRetentionMetadata(row, now, options).keep);
}

function collectOperationalDateCandidates(row: Record<string, unknown>) {
  const entries = Object.entries(row);
  const candidates: Array<{ field: string; value: unknown }> = [];
  const seen = new Set<string>();

  for (const field of OPERATIONAL_DATE_FIELDS) {
    const found = entries.find(
      ([key]) => normalizeFieldKey(key) === normalizeFieldKey(field)
    );

    if (found && hasValue(found[1])) {
      candidates.push({ field: found[0], value: found[1] });
      seen.add(normalizeFieldKey(found[0]));
    }
  }

  for (const [field, value] of entries) {
    const normalized = normalizeFieldKey(field);
    if (seen.has(normalized) || !hasValue(value)) continue;
    if (!looksLikeOperationalDateField(normalized)) continue;
    candidates.push({ field, value });
  }

  return candidates;
}

function looksLikeOperationalDateField(normalizedField: string): boolean {
  if (EXCLUDED_DATE_KEY_PARTS.some((part) => normalizedField.includes(part))) {
    return false;
  }

  return (
    normalizedField.includes("date") ||
    normalizedField.endsWith("dt") ||
    normalizedField.includes("dos")
  );
}

function parseImportDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return startOfDay(value);
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const parsed = new Date(raw.replace(/\s+12:00:00\s+AM$/i, ""));
  if (Number.isNaN(parsed.getTime())) return null;

  return startOfDay(parsed);
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function normalizeFieldKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}
