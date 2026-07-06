"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  type FirestoreError,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import type {
  HospicePatient,
  RiskFilter,
  SortMode,
  StatusFilter,
} from "./hospice-types";
import {
  filterHospicePatients,
  getHospiceStats,
  getRecentMemorialPatients,
  isActiveHospiceReportPatient,
  mergeHospicePatients,
  normalizeHospiceDoc,
} from "./hospice-utils";

const HOSPICE_COLLECTIONS = ["hospicePatients", "patients"] as const;

type HospiceCollectionName = (typeof HOSPICE_COLLECTIONS)[number];

type HospiceCollectionRecords = Partial<
  Record<HospiceCollectionName, HospicePatient[]>
>;

type HospiceCollectionLoadState = Partial<Record<HospiceCollectionName, boolean>>;

type HospiceCollectionErrors = Partial<Record<HospiceCollectionName, string>>;

function formatFirestoreError(
  collectionName: HospiceCollectionName,
  error: FirestoreError
): string {
  if (error.code === "permission-denied") {
    return `Could not load ${collectionName}. Firestore rules denied access.`;
  }

  if (error.code === "unavailable") {
    return `Could not load ${collectionName}. Firestore is temporarily unavailable.`;
  }

  return `Could not load ${collectionName}. ${error.message}`;
}

function allCollectionsFinished(loadState: HospiceCollectionLoadState): boolean {
  return HOSPICE_COLLECTIONS.every(
    (collectionName) => loadState[collectionName] === true
  );
}

export function useHospiceReport() {
  const [collectionRecords, setCollectionRecords] =
    useState<HospiceCollectionRecords>({});

  const [collectionLoadState, setCollectionLoadState] =
    useState<HospiceCollectionLoadState>({});

  const [collectionErrors, setCollectionErrors] =
    useState<HospiceCollectionErrors>({});

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("riskDesc");

  useEffect(() => {
    let isMounted = true;

    setCollectionRecords({});
    setCollectionLoadState({});
    setCollectionErrors({});

    const unsubscribers = HOSPICE_COLLECTIONS.map((collectionName) => {
      const hospiceQuery =
        collectionName === "patients"
          ? query(collection(db, collectionName), where("hospice", "==", true))
          : query(collection(db, collectionName));

      return onSnapshot(
        hospiceQuery,
        (snapshot) => {
          if (!isMounted) return;

          const records = snapshot.docs.map((doc) =>
            normalizeHospiceDoc(doc.id, doc.data(), collectionName)
          );

          setCollectionRecords((prev) => ({
            ...prev,
            [collectionName]: records,
          }));

          setCollectionLoadState((prev) => ({
            ...prev,
            [collectionName]: true,
          }));

          setCollectionErrors((prev) => {
            if (!prev[collectionName]) return prev;

            const next = { ...prev };
            delete next[collectionName];

            return next;
          });
        },
        (error) => {
          if (!isMounted) return;

          console.error(`Hospice listener failed for ${collectionName}:`, error);

          setCollectionRecords((prev) => ({
            ...prev,
            [collectionName]: [],
          }));

          setCollectionLoadState((prev) => ({
            ...prev,
            [collectionName]: true,
          }));

          setCollectionErrors((prev) => ({
            ...prev,
            [collectionName]: formatFirestoreError(collectionName, error),
          }));
        }
      );
    });

    return () => {
      isMounted = false;

      unsubscribers.forEach((unsubscribe) => {
        unsubscribe();
      });
    };
  }, []);

  const loading = useMemo(() => {
    return !allCollectionsFinished(collectionLoadState);
  }, [collectionLoadState]);

  const loadError = useMemo(() => {
    const errors = HOSPICE_COLLECTIONS.map(
      (collectionName) => collectionErrors[collectionName]
    ).filter(Boolean);

    return errors.length > 0 ? errors.join(" ") : null;
  }, [collectionErrors]);

  const patients = useMemo(() => {
    const records = HOSPICE_COLLECTIONS.flatMap(
      (collectionName) => collectionRecords[collectionName] ?? []
    );

    return mergeHospicePatients(records);
  }, [collectionRecords]);

  const activePatients = useMemo(() => {
    return patients.filter(isActiveHospiceReportPatient);
  }, [patients]);

  const memorialPatients = useMemo(() => {
    return getRecentMemorialPatients(patients);
  }, [patients]);

  const stats = useMemo(() => {
    return getHospiceStats(activePatients);
  }, [activePatients]);

  const filteredPatients = useMemo(() => {
    return filterHospicePatients({
      patients: activePatients,
      searchText,
      statusFilter,
      riskFilter,
      sortMode,
    });
  }, [activePatients, searchText, statusFilter, riskFilter, sortMode]);

  return {
    patients,
    activePatients,
    memorialPatients,
    filteredPatients,
    stats,
    loading,
    loadError,

    searchText,
    setSearchText,

    statusFilter,
    setStatusFilter,

    riskFilter,
    setRiskFilter,

    sortMode,
    setSortMode,
  };
}


