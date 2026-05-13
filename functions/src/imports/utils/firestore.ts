import { getFirestore } from "firebase-admin/firestore";

export const db = getFirestore();

export const FIRESTORE_BATCH_SIZE = 400;

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}