"use client";

import {
  DocumentReference,
  addDoc,
  collection,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type AuditDetails = Record<string, unknown>;

export async function safeUpdateDocument(
  ref: DocumentReference,
  data: Record<string, unknown>,
  audit?: {
    action: string;
    actorUid?: string | null;
    actorEmail?: string | null;
    targetUid?: string | null;
    targetEmail?: string | null;
    details?: AuditDetails;
  }
): Promise<void> {
  await updateDoc(ref, data);

  if (audit) {
    await addDoc(collection(db, "auditLogs"), {
      action: audit.action,
      actorUid: audit.actorUid ?? null,
      actorEmail: audit.actorEmail ?? null,
      targetUid: audit.targetUid ?? null,
      targetEmail: audit.targetEmail ?? null,
      details: audit.details ?? {},
      createdAt: serverTimestamp(),
    });
  }
}

export async function safeSetDocument(
  ref: DocumentReference,
  data: Record<string, unknown>,
  audit?: {
    action: string;
    actorUid?: string | null;
    actorEmail?: string | null;
    targetUid?: string | null;
    targetEmail?: string | null;
    details?: AuditDetails;
  }
): Promise<void> {
  await setDoc(ref, data, { merge: true });

  if (audit) {
    await addDoc(collection(db, "auditLogs"), {
      action: audit.action,
      actorUid: audit.actorUid ?? null,
      actorEmail: audit.actorEmail ?? null,
      targetUid: audit.targetUid ?? null,
      targetEmail: audit.targetEmail ?? null,
      details: audit.details ?? {},
      createdAt: serverTimestamp(),
    });
  }
}