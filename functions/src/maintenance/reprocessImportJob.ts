// functions/src/maintenance/reprocessImportJob.ts

import {
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";

import { logger } from "firebase-functions";

import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";

import { getStorage } from "firebase-admin/storage";

import {
  cleanText,
  makeSafeDocId,
} from "../imports/utils/normalize.js";

const db = getFirestore();
const storage = getStorage();

const MAX_REPROCESS_COUNT = 10;

type ReprocessImportJobRequest = {
  jobId?: string;
  force?: boolean;
};

type ReprocessImportJobResult = {
  ok: boolean;

  jobId: string;

  storagePath: string;

  bucket: string;

  fileType: "csv" | "pdf";

  fileName: string;

  reprocessRequestedAt: string;
};

type CallableRequestLike = {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };

  data: ReprocessImportJobRequest;
};

function normalizeString(
  value: unknown
): string {
  return cleanText(value);
}

function getAuthEmail(
  request: CallableRequestLike
): string {
  const email =
    request.auth?.token.email;

  return typeof email === "string"
    ? email
    : "";
}

function requireStaffOrAdmin(
  request: CallableRequestLike
): void {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in."
    );
  }

  const role =
    request.auth.token.role;

  if (
    role !== "admin" &&
    role !== "staff"
  ) {
    throw new HttpsError(
      "permission-denied",
      "Only staff or admins can reprocess import jobs."
    );
  }
}

function getFileNameFromPath(
  storagePath: string
): string {
  return (
    storagePath.split("/").pop() ||
    "unknown-file"
  );
}

function getFileExtension(
  storagePath: string
): "csv" | "pdf" | null {
  const lower =
    storagePath.toLowerCase();

  if (lower.endsWith(".csv")) {
    return "csv";
  }

  if (lower.endsWith(".pdf")) {
    return "pdf";
  }

  return null;
}

function assertSafeJobId(
  jobId: string
): void {
  if (
    !/^[a-zA-Z0-9_-]{6,160}$/.test(
      jobId
    )
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid import job ID."
    );
  }
}

function assertReprocessAllowed(
  params: {
    force: boolean;
    currentStatus: string;
    currentProcessingStatus: string;
    reprocessCount: number;
  }
): void {
  const {
    force,
    currentStatus,
    currentProcessingStatus,
    reprocessCount,
  } = params;

  if (
    reprocessCount >=
    MAX_REPROCESS_COUNT
  ) {
    throw new HttpsError(
      "resource-exhausted",
      `Maximum reprocess count exceeded (${MAX_REPROCESS_COUNT}).`
    );
  }

  if (
    !force &&
    (
      currentStatus ===
        "processing" ||

      currentProcessingStatus ===
        "queued_for_reprocess" ||

      currentProcessingStatus ===
        "refresh_touching_storage_file"
    )
  ) {
    throw new HttpsError(
      "failed-precondition",
      "This import job is already processing or queued."
    );
  }
}

export const reprocessImportJob =
  onCall<
    ReprocessImportJobRequest
  >(
    {
      region: "us-central1",

      memory: "1GiB",

      timeoutSeconds: 300,
    },

    async (
      request
    ): Promise<ReprocessImportJobResult> => {
      requireStaffOrAdmin(
        request as CallableRequestLike
      );

      const jobId =
        normalizeString(
          request.data?.jobId
        );

      const force =
        request.data?.force ===
        true;

      if (!jobId) {
        throw new HttpsError(
          "invalid-argument",
          "Missing import job ID."
        );
      }

      assertSafeJobId(jobId);

      const uid =
        request.auth!.uid;

      const email =
        getAuthEmail(
          request as CallableRequestLike
        );

      const jobRef =
        db
          .collection(
            "importJobs"
          )
          .doc(jobId);

      const jobSnap =
        await jobRef.get();

      if (!jobSnap.exists) {
        throw new HttpsError(
          "not-found",
          `Import job ${jobId} was not found.`
        );
      }

      const job =
        jobSnap.data() ?? {};

      const storagePath =
        normalizeString(
          job.storagePath
        );

      const storageBucket =
        normalizeString(
          job.storageBucket
        );

      const currentStatus =
        normalizeString(
          job.status
        );

      const currentProcessingStatus =
        normalizeString(
          job.processingStatus
        );

      const reprocessCount =
        Number(
          job.reprocessCount ??
            0
        ) || 0;

      if (!storagePath) {
        throw new HttpsError(
          "failed-precondition",
          "This import job has no saved Storage path."
        );
      }

      assertReprocessAllowed({
        force,

        currentStatus,

        currentProcessingStatus,

        reprocessCount,
      });

      const fileType =
        getFileExtension(
          storagePath
        );

      if (!fileType) {
        throw new HttpsError(
          "failed-precondition",
          "Only CSV and PDF import jobs can be reprocessed."
        );
      }

      const bucket =
        storageBucket
          ? storage.bucket(
              storageBucket
            )
          : storage.bucket();

      const file =
        bucket.file(
          storagePath
        );

      const [exists] =
        await file.exists();

      if (!exists) {
        throw new HttpsError(
          "not-found",
          `Cloud file was not found at ${storagePath}.`
        );
      }

      const reprocessAt =
        Timestamp.now();

      const reprocessAtIso =
        reprocessAt
          .toDate()
          .toISOString();

      const fileName =
        normalizeString(
          job.fileName
        ) ||
        getFileNameFromPath(
          storagePath
        );

      const retriggerToken =
        makeSafeDocId(
          `${jobId}_${Date.now()}`
        );

      await jobRef.set(
        {
          status: "uploaded",

          processingStatus:
            "queued_for_reprocess",

          processingStage:
            "queued_for_reprocess",

          fileName,

          fileType,

          storagePath,

          storageBucket:
            bucket.name,

          uploadedToCloud: true,

          cloudVerified: true,

          cloudUploadVerified: true,

          processedRows: 0,

          totalRows: 0,

          error: null,

          errorMessage: "",

          progressPercent: 0,

          reprocessRequestedAt:
            reprocessAt,

          reprocessRequestedByUid:
            uid,

          reprocessRequestedByEmail:
            email,

          reprocessCount:
            FieldValue.increment(
              1
            ),

          reprocessToken:
            retriggerToken,

          updatedAt:
            reprocessAt,
        },
        { merge: true }
      );

      const [metadata] =
        await file.getMetadata();

      /*
        Firebase Storage finalize triggers are weirdly stubborn.
        Updating metadata alone is unreliable.
        Rewriting the file generation forces a finalize event.
      */

      await file.copy(file, {
        contentType:
          metadata.contentType ||
          (
            fileType === "csv"
              ? "text/csv"
              : "application/pdf"
          ),

        metadata: {
          ...(metadata.metadata ??
            {}),

          reprocessJobId:
            jobId,

          reprocessToken:
            retriggerToken,

          reprocessRequestedAt:
            reprocessAtIso,

          reprocessRequestedByUid:
            uid,

          reprocessRequestedByEmail:
            email,

          reprocessForce:
            String(force),
        },
      });

      await db
        .collection(
          "auditLogs"
        )
        .add({
          action:
            "import_job_reprocess_requested",

          actorUid: uid,

          actorEmail: email,

          targetUid: null,

          targetEmail: null,

          details: {
            jobId,

            storagePath,

            storageBucket:
              bucket.name,

            fileName,

            fileType,

            force,

            reprocessCount:
              reprocessCount +
              1,
          },

          createdAt:
            FieldValue.serverTimestamp(),
        });

      logger.info(
        "Import job queued for reprocess",
        {
          jobId,

          storagePath,

          bucket:
            bucket.name,

          fileType,

          requestedBy:
            uid,

          force,

          retriggerToken,
        }
      );

      return {
        ok: true,

        jobId,

        storagePath,

        bucket:
          bucket.name,

        fileType,

        fileName,

        reprocessRequestedAt:
          reprocessAtIso,
      };
    }
  );