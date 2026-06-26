import {
  addDoc,
  collection,
  type DocumentData,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import type { PatientIndex, PatientStatus } from "./patientTypes";

const PATIENTS_COLLECTION = "patients";
const AUDIT_COLLECTION = "auditLogs";
const TIMELINE_COLLECTION = "timeline";

type TimelineEventType = "system_event" | "import" | "note" | "task" | "status";

type AuditLogParams = {
  action: string;
  patient: PatientIndex;
  previousStatus: PatientStatus;
  newStatus: PatientStatus;
};

type TimelineEntryParams = {
  patientId: string;
  type: TimelineEventType | string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
};

type PatientSystemEventParams = {
  patientId: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
};

type PatientImportEventParams = {
  patientId: string;
  reportType: string;
  fileName?: string;
  importId?: string;
  rowCount?: number;
};

function getCurrentActor() {
  const user = auth.currentUser;

  return {
    actorUid: user?.uid ?? null,
    actorEmail: user?.email ?? null,
  };
}

function getSystemActor() {
  return {
    actorUid: "system",
    actorEmail: "system",
  };
}

function getPatientTimelineCollection(patientId: string) {
  return collection(db, PATIENTS_COLLECTION, patientId, TIMELINE_COLLECTION);
}

async function writeTimelineDocument(
  patientId: string,
  payload: DocumentData,
): Promise<void> {
  await addDoc(getPatientTimelineCollection(patientId), {
    ...payload,
    createdAt: serverTimestamp(),
  });
}

export async function writeAuditLog({
  action,
  patient,
  previousStatus,
  newStatus,
}: AuditLogParams): Promise<void> {
  await addDoc(collection(db, AUDIT_COLLECTION), {
    action,

    ...getCurrentActor(),

    targetId: patient.id,
    targetName: patient.fullName,
    targetCollection: PATIENTS_COLLECTION,

    previousStatus,
    newStatus,

    details: {
      patientId: patient.id,
      patientName: patient.fullName,
      dateOfBirth: patient.dateOfBirth || null,
      hospice: patient.hospice ?? false,
      riskScore: patient.riskScore ?? 0,
      timestamp: new Date().toISOString(),
    },

    createdAt: serverTimestamp(),
  });
}

export async function addTimelineEntry({
  patientId,
  type,
  title,
  body,
  metadata,
}: TimelineEntryParams): Promise<void> {
  await writeTimelineDocument(patientId, {
    type,
    title,
    body: body ?? "",
    metadata: metadata ?? {},
    ...getCurrentActor(),
  });
}

export async function addPatientSystemEvent({
  patientId,
  title,
  body,
  metadata,
}: PatientSystemEventParams): Promise<void> {
  await writeTimelineDocument(patientId, {
    type: "system_event",
    title,
    body: body ?? "",
    metadata: metadata ?? {},
    ...getSystemActor(),
  });
}

export async function addPatientImportEvent({
  patientId,
  reportType,
  fileName,
  importId,
  rowCount,
}: PatientImportEventParams): Promise<void> {
  await writeTimelineDocument(patientId, {
    type: "import",
    title: `Imported ${reportType} report`,
    body: fileName ? `Source file: ${fileName}` : "",
    metadata: {
      importId: importId ?? null,
      reportType,
      fileName: fileName ?? null,
      rowCount: rowCount ?? 0,
    },
    ...getSystemActor(),
  });
}
