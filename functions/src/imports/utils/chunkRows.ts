export function chunkRows<T>(rows: T[], size = 250): T[][] {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("chunkRows size must be greater than zero.");
  }

  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}
