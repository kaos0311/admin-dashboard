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
  return records.reduce<RentalStats>(
    (stats, record) => {
      const overdue = isRentalOverdue(record);

      stats.total += 1;

      if (record.status === "available") stats.available += 1;
      if (record.status === "checked_out") stats.checkedOut += 1;
      if (record.status === "maintenance") stats.maintenance += 1;
      if (overdue || record.status === "overdue") stats.overdue += 1;

      if (record.status === "checked_out" || record.status === "overdue") {
        stats.monthlyRevenue += record.monthlyRate;
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
    }
  );
}