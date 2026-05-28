import { useMemo } from "react";
import type { RentalRecord, RentalStats } from "../rentals-types";
import { calculateRentalStats } from "../utils/calculations";

export function useRentalStats(records: RentalRecord[]): RentalStats {
  return useMemo(() => calculateRentalStats(records), [records]);
}
