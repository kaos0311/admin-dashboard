"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { PatientIndexAnalytics } from "../upload-types";
import { readPatientIndex } from "../upload-utils";

type UsePatientIndexAnalyticsResult = {
  patientIndex: PatientIndexAnalytics;
  analyticsLoading: boolean;
  analyticsError: string | null;
  refreshPatientIndex: () => Promise<void>;
};

const EMPTY_PATIENT_INDEX: PatientIndexAnalytics = {};

const PATIENT_INDEX_SOURCES = [
  {
    collectionName: "analytics",
    documentId: "patientIndex",
  },
  {
    collectionName: "patientIndex",
    documentId: "summary",
  },
] as const;

async function loadPatientIndexAnalytics(): Promise<PatientIndexAnalytics> {
  for (const source of PATIENT_INDEX_SOURCES) {
    const snapshot = await getDoc(
      doc(db, source.collectionName, source.documentId),
    );

    if (snapshot.exists()) {
      return readPatientIndex(snapshot.data());
    }
  }

  return EMPTY_PATIENT_INDEX;
}

export function usePatientIndexAnalytics(
  canManageUploads: boolean,
): UsePatientIndexAnalyticsResult {
  const [patientIndex, setPatientIndex] =
    useState<PatientIndexAnalytics>(EMPTY_PATIENT_INDEX);

  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const refreshPatientIndex = useCallback(async () => {
    if (!canManageUploads) {
      setPatientIndex(EMPTY_PATIENT_INDEX);
      setAnalyticsLoading(false);
      setAnalyticsError(null);
      return;
    }

    setAnalyticsLoading(true);
    setAnalyticsError(null);

    try {
      const nextPatientIndex = await loadPatientIndexAnalytics();

      setPatientIndex(nextPatientIndex);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load patient index analytics.";

      console.error("[reports/upload] patientIndex analytics failed:", error);

      setPatientIndex(EMPTY_PATIENT_INDEX);
      setAnalyticsError(message);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [canManageUploads]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!canManageUploads) {
        if (!cancelled) {
          setPatientIndex(EMPTY_PATIENT_INDEX);
          setAnalyticsLoading(false);
          setAnalyticsError(null);
        }

        return;
      }

      setAnalyticsLoading(true);
      setAnalyticsError(null);

      try {
        const nextPatientIndex = await loadPatientIndexAnalytics();

        if (!cancelled) {
          setPatientIndex(nextPatientIndex);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load patient index analytics.";

        console.error("[reports/upload] patientIndex analytics failed:", error);

        if (!cancelled) {
          setPatientIndex(EMPTY_PATIENT_INDEX);
          setAnalyticsError(message);
        }
      } finally {
        if (!cancelled) {
          setAnalyticsLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [canManageUploads]);

  return useMemo(
    () => ({
      patientIndex,
      analyticsLoading,
      analyticsError,
      refreshPatientIndex,
    }),
    [patientIndex, analyticsLoading, analyticsError, refreshPatientIndex],
  );
}


