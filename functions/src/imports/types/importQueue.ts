import type { ProcessorName } from "./processorResult";

export type ImportQueueStatus =
  | "ready"
  | "active"
  | "complete"
  | "failed"
  | "dead_lettered";

export type ImportQueueJob = {
  id: string;
  importId: string;
  chunkId: string;
  processor: ProcessorName;
  status: ImportQueueStatus;
  attemptCount: number;
  maxAttempts: number;
  leaseOwner?: string;
  leaseExpiresAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  createdAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  startedAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  completedAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  nextRunAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  error?: string;
};
