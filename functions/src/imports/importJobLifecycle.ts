import { FieldValue } from "firebase-admin/firestore";

type JobRefs = {
  jobRef: FirebaseFirestore.DocumentReference;
  reportRef?: FirebaseFirestore.DocumentReference;
};

export async function markImportProcessing(
  { jobRef }: JobRefs,
  stage: string,
  progressPercent: number
): Promise<void> {
  await jobRef.set(
    {
      status: "processing",
      processingStatus: stage,
      processingStage: stage,
      progressPercent,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function markImportCompleted(params: {
  jobRef: FirebaseFirestore.DocumentReference;
  reportRef: FirebaseFirestore.DocumentReference;
  rows: number;
  rowsInserted?: number;
  rowsFailed?: number;
  durationMs: number;
  reportType: string;
  fileName: string;
  fileType: string;
}): Promise<void> {
  const {
    jobRef,
    reportRef,
    rows,
    rowsInserted = rows,
    rowsFailed = 0,
    durationMs,
    reportType,
    fileName,
    fileType,
  } = params;

  await Promise.all([
    jobRef.set(
      {
        status: "completed",
        processingStatus: "completed",
        processingStage: "completed",
        progressPercent: 100,

        totalRows: rows,
        processedRows: rows,
        rowsProcessed: rows,
        rowsInserted,
        rowsFailed,

        error: null,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        durationMs,
      },
      { merge: true }
    ),

    reportRef.set(
      {
        status: "completed",
        reportType,
        fileName,
        fileType,
        rowCount: rows,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        durationMs,
      },
      { merge: true }
    ),
  ]);
}

export async function markImportFailed(params: {
  jobRef: FirebaseFirestore.DocumentReference;
  reportRef: FirebaseFirestore.DocumentReference;
  error: unknown;
  durationMs: number;
}): Promise<void> {
  const { jobRef, reportRef, error, durationMs } = params;
  const message = error instanceof Error ? error.message : String(error);

  await Promise.all([
    jobRef.set(
      {
        status: "failed",
        processingStatus: "failed",
        processingStage: "failed",
        progressPercent: 100,
        error: message,
        failedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        durationMs,
      },
      { merge: true }
    ),

    reportRef.set(
      {
        status: "failed",
        error: message,
        failedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        durationMs,
      },
      { merge: true }
    ),
  ]);
}
