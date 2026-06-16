import type { RentalRecord, RentalStats } from "../rentals-types";

export function isRentalOverdue(record: RentalRecord): boolean {
  if (record.status !== "checked_out") return false;
  if (!record.expectedReturnDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expected = new Date(`${record.expectedReturnDate}T00:00:00`);
  if (Number.isNaN(expected.getTime())) return false;

  return expected < today;
}

export function calculateRentalStats(records: RentalRecord[]): RentalStats {
  const patientIds = new Set<string>();

  return records.reduce<RentalStats>(
    (stats, record) => {
      const overdue = isRentalOverdue(record);
      const parExpiration = record.parExpiration
        ? new Date(`${record.parExpiration}T00:00:00`)
        : null;
      const today = new Date();
      const soon = new Date();
      soon.setDate(soon.getDate() + 30);

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

      if (
        parExpiration &&
        !Number.isNaN(parExpiration.getTime()) &&
        parExpiration >= today &&
        parExpiration <= soon
      ) {
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


