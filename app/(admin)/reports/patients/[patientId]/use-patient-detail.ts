"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  PATIENTS_COLLECTION,
  type PatientRecord,
} from "./patient-detail-types";
import { normalizePatient } from "./patient-detail-utils";

export function usePatientDetail(patientId?: string) {
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!patientId) {
      setPatient(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const patientRef = doc(db, PATIENTS_COLLECTION, patientId);

    const unsubscribe = onSnapshot(
      patientRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setPatient(null);
          setLoading(false);
          return;
        }

        setPatient(
          normalizePatient(
            snapshot.id,
            snapshot.data() as Partial<PatientRecord>
          )
        );

        setLoading(false);
      },
      (error) => {
        console.error("PATIENT DETAIL LOAD ERROR:", error);
        setPatient(null);
        setLoading(false);
        setMessage("Could not load patient detail. Check Firestore permissions.");
      }
    );

    return () => unsubscribe();
  }, [patientId]);

  return {
    patient,
    loading,
    message,
    setMessage,
  };
}