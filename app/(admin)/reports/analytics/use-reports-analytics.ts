"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import toast from "react-hot-toast";

import { db, functions } from "@/lib/firebase";
import { emptyAnalytics } from "./analytics-constants";
import type {
  CallableResult,
  ReportType,
  ReportsAnalyticsDoc,
  SelectedReportType,
} from "./analytics-types";
import {
  formatCount,
  formatPercent,
  getAnalyticsHealth,
  getFriendlyError,
  normalizeAnalyticsDoc,
  reportTypeLabel,
  safeNumber,
} from "./analytics-utils";

export function useReportsAnalytics() {
  const [analytics, setAnalytics] =
    useState<ReportsAnalyticsDoc>(emptyAnalytics);
  const [selectedType, setSelectedType] = useState<SelectedReportType>("all");
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const analyticsRef = doc(db, "analytics", "reports");

    const unsubscribe = onSnapshot(
      analyticsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setAnalytics(emptyAnalytics);
          setError("Reports analytics have not been built yet.");
          setLoading(false);
          return;
        }

        setAnalytics(
          normalizeAnalyticsDoc(snapshot.data() as Record<string, unknown>)
        );
        setError("");
        setLoading(false);
      },
      (snapshotError) => {
        console.error("REPORTS ANALYTICS SNAPSHOT ERROR:", snapshotError);
        setAnalytics(emptyAnalytics);
        setError(getFriendlyError(snapshotError));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  async function rebuildAnalytics() {
    const confirmed = window.confirm(
      "Rebuild reports analytics now? This will recalculate totals from imported report data."
    );

    if (!confirmed) return;

    try {
      setRebuilding(true);
      setError("");

      const callable = httpsCallable<unknown, CallableResult>(
        functions,
        "rebuildReportsAnalytics"
      );

      const result = await callable({});
      const message =
        result.data?.message ||
        `Reports analytics rebuilt. Rows: ${formatCount(
          safeNumber(result.data?.totalRows)
        )}`;

      toast.success(message);
    } catch (rebuildError: unknown) {
      console.error("REPORTS ANALYTICS REBUILD ERROR:", rebuildError);
      const message = getFriendlyError(rebuildError);
      setError(message);
      toast.error(message);
    } finally {
      setRebuilding(false);
    }
  }

  const selectedRows = useMemo(() => {
    if (selectedType === "all") return analytics.totalRows;
    return analytics.countsByType[selectedType] ?? 0;
  }, [analytics, selectedType]);

  const breakdownRows = useMemo(() => {
    return (Object.keys(analytics.countsByType) as ReportType[])
      .map((type) => ({
        type,
        label: reportTypeLabel(type),
        count: analytics.countsByType[type],
        percent: formatPercent(analytics.countsByType[type], analytics.totalRows),
      }))
      .sort((a, b) => b.count - a.count);
  }, [analytics]);

  const visibleBreakdownRows = useMemo(() => {
    if (selectedType === "all") return breakdownRows;
    return breakdownRows.filter((row) => row.type === selectedType);
  }, [breakdownRows, selectedType]);

  const health = useMemo(
    () => getAnalyticsHealth({ analytics, loading, error }),
    [analytics, loading, error]
  );

  return {
    analytics,
    selectedType,
    setSelectedType,
    loading,
    rebuilding,
    error,
    selectedRows,
    visibleBreakdownRows,
    health,
    busy: loading || rebuilding,
    rebuildAnalytics,
  };
}