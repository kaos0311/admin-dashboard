"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";

export type PatientIndexStats = {
  totalPatients: number;
  activePatients: number;
  inactivePatients: number;
  hospicePatients: number;
  insuranceLinkedPatients: number;
  missingDob: number;
  missingPhone: number;
  missingAddress: number;
  recentlyUpdated: number;
  lastIndexedAt: Date | null;
};

type UsePatientIndexStatsResult = {
  stats: PatientIndexStats;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const EMPTY_STATS: PatientIndexStats = {
  totalPatients: 0,
  activePatients: 0,
  inactivePatients: 0,
  hospicePatients: 0,
  insuranceLinkedPatients: 0,
  missingDob: 0,
  missingPhone: 0,
  missingAddress: 0,
  recentlyUpdated: 0,
  lastIndexedAt: null,
};

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

async function countPatientsWithField(fieldName: string): Promise<number> {
  const snapshot = await getCountFromServer(
    query(collection(db, "patients_index"), where(fieldName, "!=", null)),
  );

  return snapshot.data().count;
}

async function countPatientsByStatus(statuses: string[]): Promise<number> {
  let total = 0;

  for (const status of statuses) {
    const snapshot = await getCountFromServer(
      query(collection(db, "patients_index"), where("status", "==", status)),
    );

    total += snapshot.data().count;
  }

  return total;
}

export function usePatientIndexStats(): UsePatientIndexStatsResult {
  const [stats, setStats] = useState<PatientIndexStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setError(null);
    setRefreshing(true);

    try {
      const patientsRef = collection(db, "patients_index");

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [
        totalSnapshot,
        activePatients,
        inactivePatients,
        hospiceSnapshot,
        insuranceLinkedPatients,
        dobLinkedPatients,
        phoneLinkedPatients,
        addressLinkedPatients,
        recentlyUpdatedSnapshot,
        newestSnapshot,
      ] = await Promise.all([
        getCountFromServer(patientsRef),

        countPatientsByStatus(["active", "Active", "ACTIVE"]),

        countPatientsByStatus(["inactive", "Inactive", "INACTIVE"]),

        getCountFromServer(
          query(patientsRef, where("hospiceName", "!=", null)),
        ),

        countPatientsWithField("insuranceName"),

        countPatientsWithField("dateOfBirth"),

        countPatientsWithField("phone"),

        countPatientsWithField("address"),

        getCountFromServer(
          query(patientsRef, where("updatedAt", ">=", Timestamp.fromDate(sevenDaysAgo))),
        ),

        getDocs(query(patientsRef, orderBy("updatedAt", "desc"), limit(1))),
      ]);

      const totalPatients = totalSnapshot.data().count;

      const newestDoc = newestSnapshot.docs[0]?.data();
      const lastIndexedAt = newestDoc ? toDate(newestDoc.updatedAt) : null;

      setStats({
        totalPatients,
        activePatients,
        inactivePatients,
        hospicePatients: hospiceSnapshot.data().count,
        insuranceLinkedPatients,
        missingDob: Math.max(totalPatients - dobLinkedPatients, 0),
        missingPhone: Math.max(totalPatients - phoneLinkedPatients, 0),
        missingAddress: Math.max(totalPatients - addressLinkedPatients, 0),
        recentlyUpdated: recentlyUpdatedSnapshot.data().count,
        lastIndexedAt,
      });
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load patient index stats.";

      setError(message);
      setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  return useMemo(
    () => ({
      stats,
      loading,
      refreshing,
      error,
      refresh: loadStats,
    }),
    [stats, loading, refreshing, error, loadStats],
  );
}
