import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import type { PatientIndex, PatientStatus } from "./patientTypes";

export async function writeAuditLog(params: {
  action: string;
  patient: PatientIndex;
  previousStatus: PatientStatus;
  newStatus: PatientStatus;
}) {
  const user = auth.currentUser;

  await setDoc(doc(collection(db, "auditLogs")), {
    action: params.action,
    actorUid: user?.uid ?? null,
    actorEmail: user?.email ?? null,
    targetId: params.patient.id,
    targetName: params.patient.fullName,
    targetCollection: "patients_index",
    previousStatus: params.previousStatus,
    newStatus: params.newStatus,
    details: {
      patientId: params.patient.id,
      patientName: params.patient.fullName,
      dateOfBirth: params.patient.dateOfBirth || null,
    },
    createdAt: serverTimestamp(),
  });
}

export async function addTimelineEntry(params: {
  patientId: string;
  type: string;
  title: string;
  body?: string;
}) {
  const user = auth.currentUser;

  await addDoc(collection(db, "patients_index", params.patientId, "timeline"), {
    type: params.type,
    title: params.title,
    body: params.body ?? "",
    actorUid: user?.uid ?? null,
    actorEmail: user?.email ?? null,
    createdAt: serverTimestamp(),
  });
}