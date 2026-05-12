import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { ReportType } from "@/lib/reportTypes";

export type ImportJobSnapshot = {
  id: string;
  status?: "uploaded" | "processing" | "completed" | "failed" | string;
  fileName?: string;
  fileType?: "csv" | "pdf" | string;
  reportType?: string;
  processedRows?: number;
  totalRows?: number;
  skippedHospiceRows?: number;
  hospiceRows?: number;
  error?: string;
};

export async function uploadFileForServerImport({
  file,
  reportType,
  skipHospicePatients,
}: {
  file: File;
  reportType: ReportType;
  skipHospicePatients: boolean;
}): Promise<{ jobId: string; storagePath: string; downloadURL: string }> {
  const lowerName = file.name.toLowerCase();
  const fileType = lowerName.endsWith(".pdf") ? "pdf" : "csv";
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const jobId = `${Date.now()}-${crypto.randomUUID()}`;
  const storagePath = `imports/${jobId}.${fileType}`;
  const storageRef = ref(storage, storagePath);

  await setDoc(doc(db, "importJobs", jobId), {
    id: jobId,
    fileName: file.name,
    safeFileName: safeName,
    fileType,
    reportType,
    skipHospicePatients,
    status: "uploaded",
    processedRows: 0,
    totalRows: 0,
    skippedHospiceRows: 0,
    hospiceRows: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await uploadBytes(storageRef, file, {
    contentType: fileType === "pdf" ? "application/pdf" : "text/csv",
    customMetadata: {
      jobId,
      reportType,
      fileType,
      skipHospicePatients: String(skipHospicePatients),
      originalName: file.name,
    },
  });

  const downloadURL = await getDownloadURL(storageRef);

  await setDoc(
    doc(db, "importJobs", jobId),
    {
      storagePath,
      downloadURL,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { jobId, storagePath, downloadURL };
}

export function watchImportJob(
  jobId: string,
  callback: (snapshot: ImportJobSnapshot | null) => void
) {
  return onSnapshot(doc(db, "importJobs", jobId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    callback({
      id: snapshot.id,
      ...(snapshot.data() as Omit<ImportJobSnapshot, "id">),
    });
  });
}

/**
 * Backward compatibility if older code still imports this name.
 */
export const uploadCsvForServerImport = uploadFileForServerImport;