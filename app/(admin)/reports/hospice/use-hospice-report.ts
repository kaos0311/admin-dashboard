"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query } from "firebase/firestore";

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
  mergeHospicePatients,
  normalizeHospiceDoc,
} from "./hospice-utils";

const HOSPICE_COLLECTIONS = [
  "hospicePatients",
  "hospiceCare",
  "hospiceOversight",
] as const;

export function useHospiceReport() {
  const [collectionRecords, setCollectionRecords] = useState<
    Partial<Record<(typeof HOSPICE_COLLECTIONS)[number], HospicePatient[]>>
  >({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("riskDesc");

  useEffect(() => {
    setLoading(true);
    setLoadError(null);

    const unsubscribers = HOSPICE_COLLECTIONS.map((collectionName) => {
      const hospiceQuery = query(collection(db, collectionName), limit(500));

      return onSnapshot(
        hospiceQuery,
        (snapshot) => {
          const records = snapshot.docs.map((doc) =>
            normalizeHospiceDoc(doc.id, doc.data(), collectionName)
          );

          setCollectionRecords((prev) => ({
            ...prev,
            [collectionName]: records,
          }));

          setLoading(false);
        },
        (error) => {
          console.error(error);

          setLoadError(
            `Could not load ${collectionName}. Check Firestore rules.`
          );

          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const patients = useMemo(() => {
    return mergeHospicePatients(
      HOSPICE_COLLECTIONS.flatMap(
        (collectionName) => collectionRecords[collectionName] ?? []
      )
    );
  }, [collectionRecords]);

  const stats = useMemo(() => getHospiceStats(patients), [patients]);

  const filteredPatients = useMemo(() => {
    return filterHospicePatients({
      patients,
      searchText,
      statusFilter,
      riskFilter,
      sortMode,
    });
  }, [patients, searchText, statusFilter, riskFilter, sortMode]);

  return {
    patients,
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

