"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  collection,
  type CollectionReference,
  type DocumentData,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  type QueryConstraint,
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

const PATIENTS_INDEX_COLLECTION = "patients_index";

const ACTIVE_STATUSES = ["active", "Active", "ACTIVE"];
const INACTIVE_STATUSES = ["inactive", "Inactive", "INACTIVE"];

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

function getPatientsRef(): CollectionReference<DocumentData> {
  return collection(db, PATIENTS_INDEX_COLLECTION);
}

function toDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

async function getPatientCount(
  patientsRef: CollectionReference<DocumentData>,
  ...constraints: QueryConstraint[]
): Promise<number> {
  const targetQuery =
    constraints.length > 0
      ? query(patientsRef, ...constraints)
      : patientsRef;

  const snapshot = await getCountFromServer(targetQuery);

  return snapshot.data().count;
}

async function countPatientsWithField(
  patientsRef: CollectionReference<DocumentData>,
  fieldName: string,
): Promise<number> {
  return getPatientCount(patientsRef, where(fieldName, "!=", null));
}

async function countPatientsByStatus(
  patientsRef: CollectionReference<DocumentData>,
  statuses: string[],
): Promise<number> {
  const counts = await Promise.all(
    statuses.map((status) =>
      getPatientCount(patientsRef, where("status", "==", status)),
    ),
  );

  return counts.reduce((total, count) => total + count, 0);
}

async function getLastIndexedAt(
  patientsRef: CollectionReference<DocumentData>,
): Promise<Date | null> {
  const snapshot = await getDocs(
    query(patientsRef, orderBy("updatedAt", "desc"), limit(1)),
  );

  const newestDoc = snapshot.docs[0]?.data();

  return newestDoc ? toDate(newestDoc.updatedAt) : null;
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
      const patientsRef = getPatientsRef();

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [
        totalPatients,
        activePatients,
        inactivePatients,
        hospicePatients,
        insuranceLinkedPatients,
        dobLinkedPatients,
        phoneLinkedPatients,
        addressLinkedPatients,
        recentlyUpdated,
        lastIndexedAt,
      ] = await Promise.all([
        getPatientCount(patientsRef),
        countPatientsByStatus(patientsRef, ACTIVE_STATUSES),
        countPatientsByStatus(patientsRef, INACTIVE_STATUSES),
        getPatientCount(patientsRef, where("hospiceName", "!=", null)),
        countPatientsWithField(patientsRef, "insuranceName"),
        countPatientsWithField(patientsRef, "dateOfBirth"),
        countPatientsWithField(patientsRef, "phone"),
        countPatientsWithField(patientsRef, "address"),
        getPatientCount(
          patientsRef,
          where("updatedAt", ">=", Timestamp.fromDate(sevenDaysAgo)),
        ),
        getLastIndexedAt(patientsRef),
      ]);

      setStats({
        totalPatients,
        activePatients,
        inactivePatients,
        hospicePatients,
        insuranceLinkedPatients,
        missingDob: Math.max(totalPatients - dobLinkedPatients, 0),
        missingPhone: Math.max(totalPatients - phoneLinkedPatients, 0),
        missingAddress: Math.max(totalPatients - addressLinkedPatients, 0),
        recentlyUpdated,
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


