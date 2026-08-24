export type ImportRow = Record<string, unknown>;

export type StagingChunk = {
  id: string;
  importId: string;
  chunkIndex: number;
  rowStart: number;
  rowEnd: number;
  rowCount: number;
  rows: ImportRow[];
  createdAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
};
