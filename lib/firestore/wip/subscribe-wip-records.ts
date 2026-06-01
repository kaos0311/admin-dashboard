import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { normalizeWipRecord, type WipRecord } from "@/lib/reports/wip";

type SubscribeWipRecordsParams = {
  limitCount?: number;
  onData: (records: WipRecord[]) => void;
  onError: (message: string) => void;
};

export function subscribeWipRecords({
  limitCount = 500,
  onData,
  onError,
}: SubscribeWipRecordsParams): Unsubscribe {
  const wipQuery = query(
    collection(db, "wipRecords"),
    orderBy("updatedAt", "desc"),
    limit(limitCount),
  );

  return onSnapshot(
    wipQuery,
    (snapshot) => {
      onData(snapshot.docs.map(normalizeWipRecord));
    },
    (error) => {
      console.error("Failed to subscribe to WIP records:", error);
      onError(error.message || "Failed to subscribe to WIP records.");
    },
  );
}
