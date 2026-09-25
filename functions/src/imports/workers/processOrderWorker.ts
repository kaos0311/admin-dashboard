import { processOrders } from "../processors/orders";
import { readStagingChunk } from "../staging/readStagingChunk";

export async function processOrderWorker(importId: string, chunkId: string) {
  const chunk = await readStagingChunk(importId, chunkId);
  return processOrders(importId, chunk.rows, chunk.rowStart);
}

