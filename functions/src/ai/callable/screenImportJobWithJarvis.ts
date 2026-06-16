import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import { applyJarvisImportScreening } from "../importScreening";

const db = getFirestore();

type ScreenImportRequest = {
  jobId?: string;
};

function requireStaffOrAdmin(request: {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
}): { uid: string; email: string | null; role: string } {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const role = String(request.auth.token.role ?? "");

  if (role !== "admin" && role !== "staff" && role !== "tank") {
    throw new HttpsError(
      "permission-denied",
      "Staff, admin, or Tank access required."
    );
  }

  return {
    uid: request.auth.uid,
    email:
      typeof request.auth.token.email === "string"
        ? request.auth.token.email
        : null,
    role,
  };
}

export const screenImportJobWithJarvis = onCall<ScreenImportRequest>(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    const actor = requireStaffOrAdmin(request);
    const jobId = String(request.data?.jobId ?? "").trim();

    if (!jobId) {
      throw new HttpsError("invalid-argument", "Import job ID is required.");
    }

    const screening = await applyJarvisImportScreening(jobId);

    if (!screening) {
      throw new HttpsError("not-found", "Import job was not found.");
    }

    await db.collection("auditLogs").add({
      action: "jarvis_import_screening",
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      source: "jarvis",
      targetCollection: "importJobs",
      targetId: jobId,
      severity:
        screening.status === "passed"
          ? "low"
          : screening.status === "failed"
            ? "high"
            : "medium",
      details: {
        status: screening.status,
        message: screening.message,
        findings: screening.findings,
        recommendations: screening.recommendations,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      ok: true,
      jobId,
      screening,
    };
  }
);
