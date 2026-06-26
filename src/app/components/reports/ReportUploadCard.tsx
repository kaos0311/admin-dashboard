"use client";

import { useMemo, useRef, useState } from "react";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTaskSnapshot,
} from "firebase/storage";
import { Loader2, RefreshCcw, UploadCloud } from "lucide-react";

import { auth, db, storage } from "@/lib/firebase";
import { alerts, buttons, forms, glass, typography } from "@/theme";
import { REPORT_TYPES, type ReportType } from "@/lib/reportTypes";

type ReportUploadCardProps = {
  reportType: ReportType;
  title: string;
  description?: string;
};

const ACCEPTED_FILE_TYPES = ".csv,text/csv";

function cleanFileName(name: string): string {
  return name
    .trim()
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 140);
}

function getFileExtension(fileName: string): "csv" | null {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".csv")) return "csv";

  return null;
}

function getMimeType(file: File): string {
  if (file.type) return file.type;
  return "text/csv";
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${
    units[index]
  }`;
}

function reportTypeLabel(value: string): string {
  const found = REPORT_TYPES.find((type) => type.value === value);
  return found?.label ?? value;
}

export default function ReportUploadCard({
  reportType,
  title,
  description,
}: ReportUploadCardProps) {
  const inputId = `report-upload-${reportType}`;
  const uploadLockRef = useRef(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState("");

  const selectedFileType = useMemo(() => {
    return selectedFile ? getFileExtension(selectedFile.name) : null;
  }, [selectedFile]);

  const canUpload = Boolean(selectedFile && selectedFileType) && !uploading;

  function resetSelectedFile() {
    setSelectedFile(null);
    setUploadProgress(0);
    setMessage("");

    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (input) input.value = "";
  }

  async function handleUpload(): Promise<void> {
    if (uploadLockRef.current || uploading) return;

    if (!selectedFile) {
      setMessage("Choose a CSV file first.");
      return;
    }

    const fileType = getFileExtension(selectedFile.name);

    if (!fileType) {
      setMessage("Only CSV files are supported by the automated import pipeline.");
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      setMessage("You must be logged in to upload reports.");
      return;
    }

    uploadLockRef.current = true;
    setUploading(true);
    setUploadProgress(0);
    setMessage("");

    try {
      const jobRef = doc(collection(db, "importJobs"));
      const jobId = jobRef.id;

      const safeFileName = cleanFileName(selectedFile.name);
      const mimeType = getMimeType(selectedFile);
      const storageBucket = storage.app.options.storageBucket ?? "";
      const storagePath = `reports/uploads/${reportType}/${jobId}-${safeFileName}`;
      const storageRef = ref(storage, storagePath);

      await setDoc(jobRef, {
        id: jobId,

        fileName: selectedFile.name,
        originalFileName: selectedFile.name,
        safeFileName,
        fileType,
        mimeType,
        fileSize: selectedFile.size,

        primaryReportType: reportType,
        reportType,
        selectedReportType: reportType,
        reportTypes: [reportType],
        selectedReportTypes: [reportType],
        reportLabel: reportTypeLabel(reportType),

        storagePath,
        storageBucket,
        downloadURL: null,

        uploadedToCloud: false,
        cloudVerified: false,
        cloudUploadVerified: false,

        status: "created",


        uploadedByUid: user.uid,
        createdByEmail: user.email ?? null,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMessage("Import job created. Uploading to Firebase Storage...");

      const uploadTask = uploadBytesResumable(storageRef, selectedFile, {
        contentType: mimeType,
        customMetadata: {
          jobId,
          primaryReportType: reportType,
          reportType,
          reportTypes: reportType,
          originalFileName: selectedFile.name,
          uploadedByUid: user.uid,
          createdByEmail: user.email ?? "",
        },
      });

      await new Promise<UploadTaskSnapshot>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress =
              snapshot.totalBytes > 0
                ? Math.round(
                    (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                  )
                : 0;

            setUploadProgress(progress);
          },
          reject,
          () => resolve(uploadTask.snapshot)
        );
      });

      const downloadURL = await getDownloadURL(storageRef);

      await setDoc(
        jobRef,
        {
          status: "queued_for_cloud_function",

          downloadURL,
          storagePath,
          storageBucket,

          uploadedToCloud: true,
          cloudVerified: true,
          cloudUploadVerified: true,

          uploadedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMessage(`${title} uploaded and queued for processing.`);
      resetSelectedFile();
    } catch (error) {
      console.error("REPORT PAGE UPLOAD ERROR:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Upload failed. Check Firebase permissions."
      );
    } finally {
      uploadLockRef.current = false;
      setUploading(false);
    }
  }

  return (
    <section className={glass.cardPadded}>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-white">{title}</h2>

        <p className={typography.bodyFaint}>
          {description ??
            `Upload a CSV directly into the ${reportTypeLabel(
              reportType
            )} import pipeline.`}
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label
            htmlFor={inputId}
            className={`mb-2 block ${typography.formLabel}`}
          >
            CSV file
          </label>

          <input
            id={inputId}
            name={inputId}
            title={title}
            aria-label={title}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            disabled={uploading}
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setSelectedFile(nextFile);
              setUploadProgress(0);
              setMessage("");
            }}
            className={forms.fileInput}
          />
        </div>

        {selectedFile ? (
          <div className={`${glass.insetPadded} ${typography.body}`}>
            <div>
              <span className={typography.smallMuted}>File:</span> {selectedFile.name}
            </div>
            <div>
              <span className={typography.smallMuted}>Size:</span>{" "}
              {formatBytes(selectedFile.size)}
            </div>
            <div>
              <span className={typography.smallMuted}>Report type:</span>{" "}
              {reportTypeLabel(reportType)}
            </div>
            <div>
              <span className={typography.smallMuted}>Cloud folder:</span>{" "}
              reports/uploads/{reportType}/
            </div>

            {!selectedFileType ? (
              <div className={`mt-3 ${alerts.danger}`}>
                Unsupported file type. Use CSV.
              </div>
            ) : null}
          </div>
        ) : null}

        {uploading || uploadProgress > 0 ? (
          <div className={alerts.info}>
            <div className={`mb-2 flex items-center justify-between ${typography.bodyStrong}`}>
              <span>Uploading</span>
              <span>{uploadProgress}%</span>
            </div>

            <progress
              value={uploadProgress}
              max={100}
              aria-label={`${title} upload progress`}
              className="h-2 w-full overflow-hidden rounded-full"
            />
          </div>
        ) : null}

        {message ? (
          <div className={`${glass.insetPadded} ${typography.body}`}>
            {message}
          </div>
        ) : null}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={!canUpload}
            className={`${buttons.primary} flex-1 py-3`}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                Upload {reportTypeLabel(reportType)}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={resetSelectedFile}
            disabled={uploading}
            className={`${buttons.secondary} py-3`}
          >
            <RefreshCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}




