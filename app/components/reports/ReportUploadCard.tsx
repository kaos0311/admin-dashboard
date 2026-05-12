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
import { REPORT_TYPES, type ReportType } from "@/lib/reportTypes";

type ReportUploadCardProps = {
  reportType: ReportType;
  title: string;
  description?: string;
};

const ACCEPTED_FILE_TYPES = ".csv,.pdf,text/csv,application/pdf";

function cleanFileName(name: string): string {
  return name
    .trim()
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 140);
}

function getFileExtension(fileName: string): "csv" | "pdf" | null {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".pdf")) return "pdf";

  return null;
}

function getMimeType(file: File, fileType: "csv" | "pdf"): string {
  if (file.type) return file.type;
  return fileType === "pdf" ? "application/pdf" : "text/csv";
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
      setMessage("Choose a CSV or PDF file first.");
      return;
    }

    const fileType = getFileExtension(selectedFile.name);

    if (!fileType) {
      setMessage("Only CSV and PDF files are supported.");
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
      const mimeType = getMimeType(selectedFile, fileType);
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
        processingStatus: "waiting_for_cloud_upload",

        uploadedByUid: user.uid,
        uploadedByEmail: user.email ?? null,

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
          uploadedByEmail: user.email ?? "",
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
          status: "uploaded",
          processingStatus: "queued_for_cloud_function",

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
    <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-xl">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-white">{title}</h2>

        <p className="text-sm text-zinc-500">
          {description ??
            `Upload a CSV or PDF directly into the ${reportTypeLabel(
              reportType
            )} import pipeline.`}
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label
            htmlFor={inputId}
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            CSV or PDF file
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
            className="block w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-black disabled:opacity-60"
          />
        </div>

        {selectedFile ? (
          <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4 text-sm text-zinc-300">
            <div>
              <span className="text-zinc-500">File:</span> {selectedFile.name}
            </div>
            <div>
              <span className="text-zinc-500">Size:</span>{" "}
              {formatBytes(selectedFile.size)}
            </div>
            <div>
              <span className="text-zinc-500">Report type:</span>{" "}
              {reportTypeLabel(reportType)}
            </div>
            <div>
              <span className="text-zinc-500">Cloud folder:</span>{" "}
              reports/uploads/{reportType}/
            </div>

            {!selectedFileType ? (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-200">
                Unsupported file type. Use CSV or PDF.
              </div>
            ) : null}
          </div>
        ) : null}

        {uploading || uploadProgress > 0 ? (
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
            <div className="mb-2 flex items-center justify-between text-sm text-cyan-100">
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
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-zinc-200">
            {message}
          </div>
        ) : null}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={!canUpload}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}