import { processHospice } from "../processors/hospice";
import { readStagingChunk } from "../staging/readStagingChunk";

export async function processHospiceWorker(importId: string, chunkId: string) {
  const chunk = await readStagingChunk(importId, chunkId);
  return processHospice(importId, chunk.rows, chunk.rowStart);
}
