import type { RentalRecord, RentalStats } from "../rentals-types";

export function parseRentalDate(value: string): Date | null {
  if (!value) return null;

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isRentalOverdue(record: RentalRecord): boolean {
  if (record.status !== "checked_out") return false;

  const expected = parseRentalDate(record.expectedReturnDate);
  if (!expected) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return expected < today;
}

export function isRentalParExpired(record: RentalRecord): boolean {
  const expiration = parseRentalDate(record.parExpiration);
  if (!expiration) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return expiration < today;
}

export function isRentalParExpiringSoon(record: RentalRecord, days = 30): boolean {
  const expiration = parseRentalDate(record.parExpiration);
  if (!expiration) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const soon = new Date(today);
  soon.setDate(soon.getDate() + days);

  return expiration >= today && expiration <= soon;
}

export function isRentalParAttentionRecord(record: RentalRecord, days = 30): boolean {
  return isRentalParExpired(record) || isRentalParExpiringSoon(record, days);
}

export function sortRentalParRecords(records: RentalRecord[]): RentalRecord[] {
  return records.slice().sort((left, right) => {
    const leftTime = parseRentalDate(left.parExpiration)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightTime = parseRentalDate(right.parExpiration)?.getTime() ?? Number.MAX_SAFE_INTEGER;

    return leftTime - rightTime;
  });
}

export function calculateRentalStats(records: RentalRecord[]): RentalStats {
  const patientIds = new Set<string>();

  return records.reduce<RentalStats>(
    (stats, record) => {
      const overdue = isRentalOverdue(record);
      const parAttention = isRentalParAttentionRecord(record);

      stats.total += 1;
      if (record.patientId || record.patientName) {
        patientIds.add(record.patientId || record.patientName);
        stats.uniquePatients = patientIds.size;
      }

      if (record.status === "available") stats.available += 1;
      if (record.status === "checked_out") stats.checkedOut += 1;
      if (record.status === "maintenance") stats.maintenance += 1;
      if (overdue || record.status === "overdue") stats.overdue += 1;

      if (record.status === "checked_out" || record.status === "overdue") {
        stats.monthlyRevenue += record.monthlyRate;
      }

      stats.totalCharge += record.extCharge || record.charge;
      stats.totalAllow += record.extAllow || record.allow;

      if (parAttention) {
        stats.expiringPars += 1;
      }

      return stats;
    },
    {
      total: 0,
      checkedOut: 0,
      available: 0,
      overdue: 0,
      maintenance: 0,
      monthlyRevenue: 0,
      uniquePatients: 0,
      totalCharge: 0,
      totalAllow: 0,
      expiringPars: 0,
    }
  );
}


