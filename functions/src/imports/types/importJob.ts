import type { ProcessorName } from "./processorResult";

export type ImportJobStatus =
  | "created"
  | "uploaded"
  | "queued"
  | "active"
  | "complete"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "dead_lettered";

export type ImportJob = {
  id: string;
  importId: string;
  storagePath: string;
  fileName: string;
  reportType: string;
  status: ImportJobStatus;
  processors: ProcessorName[];
  totalRows: number;
  processedRows: number;
  writtenRows: number;
  skippedRows: number;
  issueCount: number;
  chunkCount: number;
  activeChunkCount: number;
  completedChunkCount: number;
  failedChunkCount: number;
  attemptCount: number;
  createdAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  completedAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  error?: string;
};
