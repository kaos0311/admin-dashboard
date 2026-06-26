import type { WipAgingBucket, WipRecord } from "./wip-types";

export function getAgingBucket(daysOpen: number): Exclude<WipAgingBucket, "all"> {
  if (daysOpen >= 7) return "critical";
  if (daysOpen >= 3) return "warning";
  return "fresh";
}

export function filterByAging(records: WipRecord[], aging: WipAgingBucket) {
  if (aging === "all") return records;

  return records.filter((record) => getAgingBucket(record.daysOpen) === aging);
}
