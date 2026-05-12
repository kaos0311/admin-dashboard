import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function deleteImportedReportRow(rowId: string): Promise<void> {
  await deleteDoc(doc(db, "importedReports", rowId));
}

export async function deleteImportedReportsByFileName(
  fileName: string
): Promise<number> {
  const importedReportsRef = collection(db, "importedReports");
  let deletedCount = 0;

  while (true) {
    const q = query(
      importedReportsRef,
      where("fileName", "==", fileName),
      limit(450)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      break;
    }

    const batch = writeBatch(db);

    snap.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
    deletedCount += snap.docs.length;

    if (snap.docs.length < 450) {
      break;
    }
  }

  return deletedCount;
}

export async function deleteImportedReportsByFileNameAndType(params: {
  fileName: string;
  reportType: string;
}): Promise<number> {
  const importedReportsRef = collection(db, "importedReports");
  let deletedCount = 0;

  while (true) {
    const q = query(
      importedReportsRef,
      where("fileName", "==", params.fileName),
      where("reportType", "==", params.reportType),
      limit(450)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      break;
    }

    const batch = writeBatch(db);

    snap.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
    deletedCount += snap.docs.length;

    if (snap.docs.length < 450) {
      break;
    }
  }

  return deletedCount;
}