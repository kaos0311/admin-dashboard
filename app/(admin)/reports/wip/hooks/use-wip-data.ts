"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { subscribeWipRecords } from "@/lib/firestore/wip";
import type { WipRecord } from "@/lib/reports/wip";
import { buildWipAnalytics } from "@/lib/reports/wip";

export function useWipData() {
  const [records, setRecords] = useState<WipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeWipRecords({
      onData: (nextRecords) => {
        setRecords(nextRecords);
        setLoading(false);
      },
      onError: (message) => {
        setError(message);
        setLoading(false);
      },
    });

    return () => unsubscribe();
  }, [reloadKey]);

  const analytics = useMemo(() => buildWipAnalytics(records), [records]);

  const refresh = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  return {
    records,
    analytics,
    loading,
    error,
    refresh,
  };
}