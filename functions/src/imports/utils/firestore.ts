import {
  DocumentReference,
  FieldValue,
  Firestore,
  SetOptions,
  WriteBatch,
  getFirestore,
} from "firebase-admin/firestore";

export const db: Firestore = getFirestore();

export const FIRESTORE_MAX_BATCH_WRITES = 500;
export const FIRESTORE_BATCH_SIZE = 100;
export const FIRESTORE_CHUNK_DELAY_MS = 250;
export const FIRESTORE_RETRY_ATTEMPTS = 5;
export const FIRESTORE_RETRY_BASE_DELAY_MS = 400;

export type FirestoreData = Record<string, unknown>;

export type BatchSetOperation = {
  ref: DocumentReference;
  data: FirestoreData;
  options?: SetOptions;
};

export type BatchDeleteOperation = {
  ref: DocumentReference;
};

export function serverTimestamp(): FieldValue {
  return FieldValue.serverTimestamp();
}

export function chunkArray<T>(
  items: readonly T[],
  size = FIRESTORE_BATCH_SIZE
): T[][] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const safeSize =
    Number.isFinite(size) && size > 0
      ? Math.min(Math.floor(size), FIRESTORE_MAX_BATCH_WRITES)
      : FIRESTORE_BATCH_SIZE;

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += safeSize) {
    chunks.push(items.slice(index, index + safeSize));
  }

  return chunks;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(attempt: number): number {
  return FIRESTORE_RETRY_BASE_DELAY_MS * Math.pow(2, attempt) +
    Math.floor(Math.random() * 250);
}

function shouldRetryFirestoreError(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code).toLowerCase()
      : "";

  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    code === "aborted" ||
    code === "deadline-exceeded" ||
    code === "resource-exhausted" ||
    code === "unavailable" ||
    message.includes("deadline") ||
    message.includes("resource exhausted") ||
    message.includes("too much contention") ||
    message.includes("aborted") ||
    message.includes("unavailable")
  );
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  label = "firestore-operation",
  maxAttempts = FIRESTORE_RETRY_ATTEMPTS
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt >= maxAttempts - 1;

      if (isLastAttempt || !shouldRetryFirestoreError(error)) {
        throw error;
      }

      const delayMs = getRetryDelayMs(attempt);

      console.warn(
        `[${label}] retry ${attempt + 1}/${maxAttempts} in ${delayMs}ms`,
        error
      );

      await sleep(delayMs);
    }
  }

  throw lastError;
}

export async function commitBatchWithRetry(
  batch: WriteBatch,
  label = "firestore-batch"
): Promise<void> {
  await retryWithBackoff(async () => {
    await batch.commit();
  }, label);
}

export async function commitBatchesWithRetry(
  batches: WriteBatch[],
  label = "firestore-batches"
): Promise<void> {
  if (!Array.isArray(batches) || batches.length === 0) return;

  for (const [index, batch] of batches.entries()) {
    await commitBatchWithRetry(
      batch,
      `${label}:${index + 1}/${batches.length}`
    );

    if (index < batches.length - 1) {
      await sleep(FIRESTORE_CHUNK_DELAY_MS);
    }
  }
}

export async function batchSetDocuments(
  operations: readonly BatchSetOperation[],
  label = "batch-set-documents",
  batchSize = FIRESTORE_BATCH_SIZE
): Promise<number> {
  if (!Array.isArray(operations) || operations.length === 0) return 0;

  const chunks = chunkArray(operations, batchSize);
  let written = 0;

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const batch = db.batch();

    for (const operation of chunk) {
      if (operation.options) {
        batch.set(operation.ref, operation.data, operation.options);
      } else {
        batch.set(operation.ref, operation.data);
      }

      written += 1;
    }

    await commitBatchWithRetry(
      batch,
      `${label}:${chunkIndex + 1}/${chunks.length}`
    );

    if (chunkIndex < chunks.length - 1) {
      await sleep(FIRESTORE_CHUNK_DELAY_MS);
    }
  }

  return written;
}

/**
 * Backward-compatible helper used by existing processors.
 * Do not remove unless you enjoy rebuilding half the import pipeline for sport.
 */
export async function bulkSetDocuments<T>(
  items: readonly T[],
  getRef: (item: T, index: number) => DocumentReference,
  getData: (item: T, index: number) => FirestoreData,
  options: SetOptions = { merge: true },
  label = "bulk-set-documents",
  batchSize = FIRESTORE_BATCH_SIZE
): Promise<number> {
  if (!Array.isArray(items) || items.length === 0) return 0;

  const operations: BatchSetOperation[] = items.map((item, index) => ({
    ref: getRef(item, index),
    data: getData(item, index),
    options,
  }));

  return batchSetDocuments(operations, label, batchSize);
}

export async function batchDeleteDocuments(
  operations: readonly BatchDeleteOperation[],
  label = "batch-delete-documents",
  batchSize = FIRESTORE_BATCH_SIZE
): Promise<number> {
  if (!Array.isArray(operations) || operations.length === 0) return 0;

  const chunks = chunkArray(operations, batchSize);
  let deleted = 0;

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const batch = db.batch();

    for (const operation of chunk) {
      batch.delete(operation.ref);
      deleted += 1;
    }

    await commitBatchWithRetry(
      batch,
      `${label}:${chunkIndex + 1}/${chunks.length}`
    );

    if (chunkIndex < chunks.length - 1) {
      await sleep(FIRESTORE_CHUNK_DELAY_MS);
    }
  }

  return deleted;
}

export function createSafeBatch(): WriteBatch {
  return db.batch();
}