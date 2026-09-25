import { processActiveRentals } from "../processors/activeRentals/activeRentalsProcessor";
import { readStagingChunk } from "../staging/readStagingChunk";

export async function processActiveRentalsWorker(importId: string, chunkId: string) {
  const chunk = await readStagingChunk(importId, chunkId);
  return processActiveRentals(importId, chunk.rows, chunk.rowStart);
}
