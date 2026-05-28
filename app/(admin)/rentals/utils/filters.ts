import type { RentalFilters, RentalRecord } from "../rentals-types";
import { rentalMatchesSearch } from "./search";

export function filterRentalRecords(
  records: RentalRecord[],
  filters: RentalFilters
): RentalRecord[] {
  return records.filter((record) => {
    const statusMatch =
      filters.status === "all" || record.status === filters.status;

    return statusMatch && rentalMatchesSearch(record, filters.search);
  });
}
