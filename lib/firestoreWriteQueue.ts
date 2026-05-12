"use client";

import {
  Firestore,
  WriteBatch,
  collection,
  doc,
  writeBatch,
} from "firebase/firestore";

type PlainObject = Record<string, unknown>;

type QueueOptions = {
  chunkSize?: number;
  delayMs?: number;
  debugLabel?: string;
};

const DEFAULT_CHUNK_SIZE = 250;
const DEFAULT_DELAY_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function commitChunkedSets(
  db: Firestore,
  collectionName: string,
  rows: PlainObject[],
  options: QueueOptions = {}
): Promise<{ written: number }> {
  const chunkSize = Math.min(options.chunkSize ?? DEFAULT_CHUNK_SIZE, 450);
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const debugLabel = options.debugLabel ?? collectionName;

  if (!rows.length) {
    return { written: 0 };
  }

  const chunks = chunkArray(rows, chunkSize);
  let written = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    const batch: WriteBatch = writeBatch(db);
    const chunk = chunks[i];

    for (const row of chunk) {
      const ref = doc(collection(db, collectionName));
      batch.set(ref, row);
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[Firestore Queue] committing chunk ${i + 1}/${chunks.length} for ${debugLabel} (${chunk.length} docs)`
      );
    }

    await batch.commit();
    written += chunk.length;

    if (i < chunks.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return { written };
}

export async function commitChunkedWithCustomBuilder<T>(
  db: Firestore,
  items: T[],
  builder: (batch: WriteBatch, item: T) => void,
  options: QueueOptions = {}
): Promise<{ written: number }> {
  const chunkSize = Math.min(options.chunkSize ?? DEFAULT_CHUNK_SIZE, 450);
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const debugLabel = options.debugLabel ?? "custom-write";

  if (!items.length) {
    return { written: 0 };
  }

  const chunks = chunkArray(items, chunkSize);
  let written = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    const batch = writeBatch(db);
    const chunk = chunks[i];

    for (const item of chunk) {
      builder(batch, item);
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[Firestore Queue] committing chunk ${i + 1}/${chunks.length} for ${debugLabel} (${chunk.length} ops)`
      );
    }

    await batch.commit();
    written += chunk.length;

    if (i < chunks.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return { written };
}