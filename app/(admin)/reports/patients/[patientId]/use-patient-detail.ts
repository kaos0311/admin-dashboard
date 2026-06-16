"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  type PatientAuthorizationLine,
  type PatientRecord,
  PATIENTS_COLLECTION,
} from "./patient-detail-types";
import { normalizePatient } from "./patient-detail-utils";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeAuthorizationLine(
  id: string,
  data: Record<string, unknown>
): PatientAuthorizationLine {
  return {
    id,
    parNumber: text(data.parNumber),
    parKey: text(data.parKey),
    parStatus: text(data.parStatus),
    parExpiration: text(data.parExpiration),
    parInitialDate: text(data.parInitialDate),
    policyNumber: text(data.policyNumber),
    insurance: text(data.insurance),
    insuranceStatus: text(data.insuranceStatus),
    salesOrderId: text(data.salesOrderId),
    salesOrderStatus: text(data.salesOrderStatus),
    itemId: text(data.itemId),
    itemName: text(data.itemName),
    quantity: numberValue(data.quantity),
    procedureCode: text(data.procedureCode),
    modifiers: text(data.modifiers),
    branchOffice: text(data.branchOffice),
    actualDeliveryDate: text(data.actualDeliveryDate),
    nextBillingDate: text(data.nextBillingDate),
    orderingDoctor: text(data.orderingDoctor),
    printedBy: text(data.printedBy),
    printedAt: text(data.printedAt),
    faxedBy: text(data.faxedBy),
    faxedAt: text(data.faxedAt),
    rowIndex: numberValue(data.rowIndex),
  };
}

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
    const authorizationsQuery = query(
      collection(db, "patientAuthorizations"),
      where("patientKey", "==", patientId),
      limit(75)
    );

    let latestPatient: PatientRecord | null = null;
    let latestAuthorizations: PatientAuthorizationLine[] = [];

    function publishPatient() {
      if (!latestPatient) {
        setPatient(null);
        return;
      }

      setPatient({
        ...latestPatient,
        authorizationLines: latestAuthorizations,
      });
    }

    const unsubscribePatient = onSnapshot(
      patientRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          latestPatient = null;
          setPatient(null);
          setLoading(false);
          return;
        }

        latestPatient = normalizePatient(
          snapshot.id,
          snapshot.data() as Partial<PatientRecord>
        );
        publishPatient();

        setLoading(false);
      },
      (error) => {
        console.error("PATIENT DETAIL LOAD ERROR:", error);
        setPatient(null);
        setLoading(false);
        setMessage("Could not load patient detail. Check Firestore permissions.");
      }
    );

    const unsubscribeAuthorizations = onSnapshot(
      authorizationsQuery,
      (snapshot) => {
        latestAuthorizations = snapshot.docs
          .map((authSnapshot) =>
            normalizeAuthorizationLine(
              authSnapshot.id,
              authSnapshot.data() as Record<string, unknown>
            )
          )
          .sort((a, b) => {
            const dateA = Date.parse(a.parExpiration ?? "") || 0;
            const dateB = Date.parse(b.parExpiration ?? "") || 0;

            return dateB - dateA;
          });
        publishPatient();
      },
      (error) => {
        console.error("PATIENT PAR LINES LOAD ERROR:", error);
      }
    );

    return () => {
      unsubscribePatient();
      unsubscribeAuthorizations();
    };
  }, [patientId]);

  return {
    patient,
    loading,
    message,
    setMessage,
  };
}

