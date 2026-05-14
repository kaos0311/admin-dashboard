import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import type { PatientIndex, PatientStatus } from "./patientTypes";

const PATIENTS_COLLECTION = "patients";
const AUDIT_COLLECTION = "auditLogs";

export async function writeAuditLog(params: {
  action: string;
  patient: PatientIndex;
  previousStatus: PatientStatus;
  newStatus: PatientStatus;
}) {
  const user = auth.currentUser;

  await setDoc(doc(collection(db, AUDIT_COLLECTION)), {
    action: params.action,

    actorUid: user?.uid ?? null,
    actorEmail: user?.email ?? null,

    targetId: params.patient.id,
    targetName: params.patient.fullName,
    targetCollection: PATIENTS_COLLECTION,

    previousStatus: params.previousStatus,
    newStatus: params.newStatus,

    details: {
      patientId: params.patient.id,
      patientName: params.patient.fullName,
      dateOfBirth: params.patient.dateOfBirth || null,
      hospice: params.patient.hospice ?? false,
      riskScore: params.patient.riskScore ?? 0,
      timestamp: new Date().toISOString(),
    },

    createdAt: serverTimestamp(),
  });
}

export async function addTimelineEntry(params: {
  patientId: string;
  type: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
}) {
  const user = auth.currentUser;

  await addDoc(
    collection(db, PATIENTS_COLLECTION, params.patientId, "timeline"),
    {
      type: params.type,
      title: params.title,

      body: params.body ?? "",

      metadata: params.metadata ?? {},

      actorUid: user?.uid ?? null,
      actorEmail: user?.email ?? null,

      createdAt: serverTimestamp(),
    }
  );
}

export async function addPatientSystemEvent(params: {
  patientId: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
}) {
  await addDoc(
    collection(db, PATIENTS_COLLECTION, params.patientId, "timeline"),
    {
      type: "system_event",

      title: params.title,
      body: params.body ?? "",

      metadata: params.metadata ?? {},

      actorUid: "system",
      actorEmail: "system",

      createdAt: serverTimestamp(),
    }
  );
}

export async function addPatientImportEvent(params: {
  patientId: string;
  reportType: string;
  fileName?: string;
  importId?: string;
  rowCount?: number;
}) {
  await addDoc(
    collection(db, PATIENTS_COLLECTION, params.patientId, "timeline"),
    {
      type: "import",

      title: `Imported ${params.reportType} report`,

      body: params.fileName
        ? `Source file: ${params.fileName}`
        : "",

      metadata: {
        importId: params.importId ?? null,
        reportType: params.reportType,
        fileName: params.fileName ?? null,
        rowCount: params.rowCount ?? 0,
      },

      actorUid: "system",
      actorEmail: "system",

      createdAt: serverTimestamp(),
    }
  );
}