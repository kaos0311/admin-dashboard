// functions/src/imports/utils/firestore.ts

import { getFirestore } from "firebase-admin/firestore";

export const db = getFirestore();

export const FIRESTORE_MAX_BATCH_WRITES = 500;
export const FIRESTORE_BATCH_SIZE = 400;

export function chunkArray<T>(items: readonly T[], size = FIRESTORE_BATCH_SIZE): T[][] {
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

export function isValidFirestoreBatchSize(size: number): boolean {
  return (
    Number.isInteger(size) &&
    size > 0 &&
    size <= FIRESTORE_MAX_BATCH_WRITES
  );
}

export function clampFirestoreBatchSize(size: number): number {
  if (!Number.isFinite(size)) return FIRESTORE_BATCH_SIZE;

  return Math.max(
    1,
    Math.min(Math.floor(size), FIRESTORE_MAX_BATCH_WRITES)
  );
}