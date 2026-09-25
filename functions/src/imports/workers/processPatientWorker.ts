import { processPatients } from "../processors/patients";
import { readStagingChunk } from "../staging/readStagingChunk";

export async function processPatientWorker(importId: string, chunkId: string) {
  const chunk = await readStagingChunk(importId, chunkId);
  return processPatients(importId, chunk.rows, chunk.rowStart);
}
