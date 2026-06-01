import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { normalizeWipRecord, type WipRecord } from "@/lib/reports/wip";

export async function getWipRecords(limitCount = 500): Promise<WipRecord[]> {
  const wipQuery = query(
    collection(db, "wipRecords"),
    orderBy("updatedAt", "desc"),
    limit(limitCount),
  );

  const snapshot = await getDocs(wipQuery);

  return snapshot.docs.map(normalizeWipRecord);
}
