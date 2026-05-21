"use client";

import { useCallback, useMemo, useState } from "react";

import { MOCK_WIP_RECORDS } from "../constants/wip.constants";
import { buildWipAnalytics } from "../utils/wip-helpers";

export function useWipData() {
  const [records] = useState(MOCK_WIP_RECORDS);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  const analytics = useMemo(() => buildWipAnalytics(records), [records]);

  const refresh = useCallback(() => {
    // Firestore refresh will go here later.
  }, []);

  return {
    records,
    analytics,
    loading,
    error,
    refresh,
  };
}