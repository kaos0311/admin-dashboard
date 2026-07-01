import type { WipRecord } from "./wip-types";

export type WipAgingBucket =
  | "0-7"
  | "8-14"
  | "15-30"
  | "31-60"
  | "60+";

export type WipAgingSummary = {
  bucket: WipAgingBucket;
  label: string;
  count: number;
};

export function getWipAgingBucket(daysOld: number): WipAgingBucket {
  if (daysOld <= 7) {
    return "0-7";
  }

  if (daysOld <= 14) {
    return "8-14";
  }

  if (daysOld <= 30) {
    return "15-30";
  }

  if (daysOld <= 60) {
    return "31-60";
  }

  return "60+";
}

export function getWipAgingLabel(bucket: WipAgingBucket): string {
  switch (bucket) {
    case "0-7":
      return "0â€“7 Days";

    case "8-14":
      return "8â€“14 Days";

    case "15-30":
      return "15â€“30 Days";

    case "31-60":
      return "31â€“60 Days";

    case "60+":
      return "60+ Days";

    default:
      return "Unknown";
  }
}

export function summarizeWipAging(records: WipRecord[]): WipAgingSummary[] {
  const buckets: Record<WipAgingBucket, number> = {
    "0-7": 0,
    "8-14": 0,
    "15-30": 0,
    "31-60": 0,
    "60+": 0,
  };

  for (const record of records) {
    const bucket = getWipAgingBucket(record.daysOld);

    buckets[bucket] += 1;
  }

  return Object.entries(buckets).map(([bucket, count]) => ({
    bucket: bucket as WipAgingBucket,
    label: getWipAgingLabel(bucket as WipAgingBucket),
    count,
  }));
}


