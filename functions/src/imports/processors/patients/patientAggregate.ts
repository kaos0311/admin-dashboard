import type { PatientAggregate, PatientNormalized } from "./patientTypes";

export function aggregatePatients(
  rows: PatientNormalized[],
  importId: string
): PatientAggregate[] {
  const map = new Map<string, PatientAggregate>();

  for (const row of rows) {
    const existing = map.get(row.patientKey);

    if (!existing) {
      map.set(row.patientKey, {
        ...row,
        importIds: [importId],
        sourceRowIds: [row.sourceRowId],
        lastImportId: importId,
        duplicateCount: 0,
      });
      continue;
    }

    map.set(row.patientKey, {
      ...existing,
      ...removeEmpty(row),
      raw: { ...existing.raw, ...row.raw },
      importIds: Array.from(new Set([...existing.importIds, importId])),
      sourceRowIds: Array.from(new Set([...existing.sourceRowIds, row.sourceRowId])),
      lastImportId: importId,
      duplicateCount: existing.duplicateCount + 1,
      hospiceMarked: existing.hospiceMarked || row.hospiceMarked,
      issues: [...existing.issues, ...row.issues],
    });
  }

  return Array.from(map.values());
}

function removeEmpty<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, child]) => child !== undefined && child !== "")
  ) as Partial<T>;
}
