"use client";

import { useMemo, useState } from "react";

import type {
  WipAgingBucket,
  WipRecord,
  WipStatusFilter,
} from "@/lib/reports/wip";
import { filterByAging } from "@/lib/reports/wip";

export function useWipFilters(records: WipRecord[]) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<WipStatusFilter>("all");
  const [aging, setAging] = useState<WipAgingBucket>("all");

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    let result = records;

    if (status !== "all") {
      result = result.filter((record) => record.status === status);
    }

    result = filterByAging(result, aging);

    if (normalizedSearch) {
      result = result.filter((record) => {
        return [
          record.patientName,
          record.orderNumber,
          record.assignedTo,
          record.department,
          record.issue,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch));
      });
    }

    return result;
  }, [records, search, status, aging]);

  return {
    search,
    setSearch,
    status,
    setStatus,
    aging,
    setAging,
    filteredRecords,
  };
}
