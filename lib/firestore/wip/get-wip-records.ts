import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  isActionableWipData,
  isRecentWipData,
  normalizeWipRecord,
  type WipRecord,
} from "@/lib/reports/wip";

export async function getWipRecords(limitCount?: number): Promise<WipRecord[]> {
  const constraints = limitCount
    ? [orderBy("updatedAt", "desc"), limit(limitCount)]
    : [orderBy("updatedAt", "desc")];
  const wipQuery = query(collection(db, "wipRecords"), ...constraints);

  const snapshot = await getDocs(wipQuery);

  return snapshot.docs
    .filter((doc) => {
      const data = doc.data();

      return isActionableWipData(data) && isRecentWipData(data);
    })
    .map(normalizeWipRecord);
}
