import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  isActionableWipData,
  isRecentWipData,
  normalizeWipRecord,
  type WipRecord,
} from "@/lib/reports/wip";

type SubscribeWipRecordsParams = {
  limitCount?: number;
  onData: (records: WipRecord[]) => void;
  onError: (message: string) => void;
};

export function subscribeWipRecords({
  limitCount,
  onData,
  onError,
}: SubscribeWipRecordsParams): Unsubscribe {
  const constraints = limitCount
    ? [orderBy("updatedAt", "desc"), limit(limitCount)]
    : [orderBy("updatedAt", "desc")];
  const wipQuery = query(collection(db, "wipRecords"), ...constraints);

  return onSnapshot(
    wipQuery,
    (snapshot) => {
      onData(
        snapshot.docs
          .filter((doc) => {
            const data = doc.data();

            return isActionableWipData(data) && isRecentWipData(data);
          })
          .map(normalizeWipRecord)
      );
    },
    (error) => {
      console.error("Failed to subscribe to WIP records:", error);
      onError(error.message || "Failed to subscribe to WIP records.");
    },
  );
}
