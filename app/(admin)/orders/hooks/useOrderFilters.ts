"use client";

import { useMemo, useState } from "react";

import { initialSmartFilters } from "../lib/orderConstants";
import { normalizeSearchText } from "../lib/orderKeys";
import type { OrderRow, SmartFilters } from "../lib/orderTypes";
import { useDebouncedValue } from "./useDebouncedValue";

export function useOrderFilters(orders: OrderRow[]) {
  const [search, setSearch] = useState("");
  const [smartFilters, setSmartFilters] =
    useState<SmartFilters>(initialSmartFilters);

  const debouncedSearch = useDebouncedValue(search, 250);

  const filterOptions = useMemo(() => {
    const reportTypes = new Set<string>();
    const facilities = new Set<string>();
    const insurances = new Set<string>();

    for (const order of orders) {
      if (order.sourceReportType) reportTypes.add(order.sourceReportType);
      if (order.facilityName) facilities.add(order.facilityName);
      if (order.insurance) insurances.add(order.insurance);
    }

    return {
      reportTypes: [...reportTypes].sort(),
      facilities: [...facilities].sort(),
      insurances: [...insurances].sort(),
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = normalizeSearchText(debouncedSearch);

    return orders.filter((order) => {
      const reasons = order.reviewReasons || [];

      if (
        smartFilters.sourceReportType &&
        order.sourceReportType !== smartFilters.sourceReportType
      ) {
        return false;
      }

      if (
        smartFilters.facilityName &&
        order.facilityName !== smartFilters.facilityName
      ) {
        return false;
      }

      if (smartFilters.insurance && order.insurance !== smartFilters.insurance) {
        return false;
      }

      if (smartFilters.reviewOnly && !order.needsReview) return false;

      if (
        smartFilters.inventoryOnly &&
        !reasons.includes("inventoryNotAllocated")
      ) {
        return false;
      }

      if (
        smartFilters.hospiceRiskOnly &&
        !reasons.includes("possibleHospice")
      ) {
        return false;
      }

      if (
        smartFilters.missingProductOnly &&
        !reasons.includes("missingProduct") &&
        !reasons.includes("missingProductId")
      ) {
        return false;
      }

      if (
        smartFilters.archiveReadyOnly &&
        !reasons.includes("deliveredReadyForArchive")
      ) {
        return false;
      }

      if (!term) return true;

      const haystack =
        order.searchText ||
        normalizeSearchText(
          [
            order.patientName,
            order.patientAddress,
            order.productType,
            order.phone,
            order.facilityName,
            order.notes,
            order.barcode,
            order.salesOrderNumber,
            order.customerId,
            order.dob,
            order.insurance,
            order.patientKey,
            order.orderKey,
          ].join(" ")
        );

      return haystack.includes(term);
    });
  }, [orders, debouncedSearch, smartFilters]);

  function resetFilters() {
    setSmartFilters(initialSmartFilters);
    setSearch("");
  }

  return {
    search,
    setSearch,

    smartFilters,
    setSmartFilters,
    resetFilters,

    filterOptions,
    filteredOrders,
  };
}