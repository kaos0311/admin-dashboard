import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { WipStatus } from "@/lib/reports/wip";

type UpdateWipStatusParams = {
  recordId: string;
  status: WipStatus;
};

export async function updateWipStatus({
  recordId,
  status,
}: UpdateWipStatusParams): Promise<void> {
  await updateDoc(doc(db, "wipRecords", recordId), {
    status,
    updatedAt: serverTimestamp(),
  });
}
