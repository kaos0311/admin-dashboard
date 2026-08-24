import { processShop } from "../processors/shop/shopProcessor";
import { readStagingChunk } from "../staging/readStagingChunk";

export async function processShopWorker(importId: string, chunkId: string) {
  const chunk = await readStagingChunk(importId, chunkId);
  return processShop(importId, chunk.rows, chunk.rowStart);
}
