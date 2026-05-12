"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  FileText,
  FileUp,
  HeartPulse,
  Loader2,
  RefreshCcw,
  Trash2,
  Upload,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTaskSnapshot,
} from "firebase/storage";

import { auth, db, storage } from "@/lib/firebase";
import {
  DEFAULT_REPORT_TYPE,
  REPORT_TYPES,
  getReportOption,
  groupReportOptions,
  type ReportType,
} from "@/lib/reportTypes";

type UploadStep =
  | "idle"
  | "creating_job"
  | "uploading_cloud"
  | "marking_uploaded"
  | "queued"
  | "complete"
  | "failed";

type TimestampLike = {
  toDate?: () => Date;
} | null;

type PatientIndexStats = {
  patients: number;
  hospicePatients: number;
  wipTotal: number;
  wipOpen: number;
  wipCompleted: number;
  hospiceLiving: number;
  hospiceDeceased: number;
  lastUpdatedAt: TimestampLike;
  lastIndexedReportId: string;
  lastIndexedReportType: string;
  indexVersion: string;
};

type QueuedUpload = {
  localId: string;
  file: File;
  reportType: ReportType;
  step: UploadStep;
  progress: number;
  jobId: string;
  storagePath: string;
  downloadURL: string;
  error: string;
};

type RecentImportJob = {
  id: string;
  reportType: string;
  reportLabel: string;
  originalFileName: string;
  status: string;
  processingStatus: string;
  uploadedByEmail: string;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
};

const EMPTY_STATS: PatientIndexStats = {
  patients: 0,
  hospicePatients: 0,
  wipTotal: 0,
  wipOpen: 0,
  wipCompleted: 0,
  hospiceLiving: 0,
  hospiceDeceased: 0,
  lastUpdatedAt: null,
  lastIndexedReportId: "",
  lastIndexedReportType: "",
  indexVersion: "",
};

const MAX_FILES_PER_BATCH = 20;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

function makeLocalId(): string {
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function cleanFileName(name: string): string {
  return name
    .trim()
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function getFileExtension(fileName: string): "csv" | "pdf" | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".pdf")) return "pdf";
  return null;
}

function getMimeType(file: File, fileExtension: "csv" | "pdf"): string {
  return file.type || (fileExtension === "pdf" ? "application/pdf" : "text/csv");
}

function formatBytes(bytes: number): string {
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

function safeNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toTimestampLike(value: unknown): TimestampLike {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return value as TimestampLike;
  }

  return null;
}

function formatTimestamp(value: TimestampLike): string {
  if (!value || typeof value.toDate !== "function") return "Never";

  try {
    return value.toDate().toLocaleString();
  } catch {
    return "Never";
  }
}

function readPatientIndexStats(data: DocumentData | undefined): PatientIndexStats {
  if (!data) return EMPTY_STATS;

  return {
    patients: safeNumber(data.totalPatients ?? data.patients),
    hospicePatients: safeNumber(data.hospicePatients),
    wipTotal: safeNumber(data.wipTotal ?? data.totalWips),
    wipOpen: safeNumber(data.wipOpen ?? data.openWips),
    wipCompleted: safeNumber(data.wipCompleted ?? data.completedWips),
    hospiceLiving: safeNumber(data.hospiceLiving ?? data.livingHospiceRows),
    hospiceDeceased: safeNumber(data.hospiceDeceased ?? data.deceasedHospiceRows),
    lastUpdatedAt: toTimestampLike(data.lastUpdatedAt ?? data.updatedAt),
    lastIndexedReportId: safeString(data.lastIndexedReportId),
    lastIndexedReportType: safeString(data.lastIndexedReportType),
    indexVersion: safeString(data.indexVersion),
  };
}

function normalizeRecentJob(id: string, data: DocumentData): RecentImportJob {
  return {
    id,
    reportType: safeString(data.reportType),
    reportLabel: safeString(data.reportLabel),
    originalFileName: safeString(data.originalFileName),
    status: safeString(data.status),
    processingStatus: safeString(data.processingStatus),
    uploadedByEmail: safeString(data.uploadedByEmail),
    createdAt: toTimestampLike(data.createdAt),
    updatedAt: toTimestampLike(data.updatedAt),
  };
}

function getStepLabel(step: UploadStep): string {
  if (step === "idle") return "Ready";
  if (step === "creating_job") return "Creating job";
  if (step === "uploading_cloud") return "Uploading";
  if (step === "marking_uploaded") return "Verifying";
  if (step === "queued") return "Queued";
  if (step === "complete") return "Complete";
  return "Failed";
}

function validateFile(file: File): string {
  const extension = getFileExtension(file.name);

  if (!extension) {
    return "Only CSV and PDF files are supported.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File is too large. Max allowed is ${formatBytes(MAX_FILE_SIZE_BYTES)}.`;
  }

  return "";
}

export default function UploadReportPage() {
  const [defaultReportType, setDefaultReportType] =
    useState<ReportType>(DEFAULT_REPORT_TYPE);
  const [queue, setQueue] = useState<QueuedUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");

  const [statsLoading, setStatsLoading] = useState(true);
  const [analyticsMissing, setAnalyticsMissing] = useState(false);
  const [stats, setStats] = useState<PatientIndexStats>(EMPTY_STATS);

  const [recentJobs, setRecentJobs] = useState<RecentImportJob[]>([]);
  const [recentJobsLoading, setRecentJobsLoading] = useState(true);

  const uploadLockRef = useRef(false);

  const groupedOptions = useMemo(() => groupReportOptions(REPORT_TYPES), []);
  const defaultSelectedOption = getReportOption(defaultReportType);

  const batchStats = useMemo(() => {
    const totalBytes = queue.reduce((sum, item) => sum + item.file.size, 0);
    const completed = queue.filter((item) => item.step === "complete").length;
    const failed = queue.filter((item) => item.step === "failed").length;
    const ready = queue.filter((item) => item.step === "idle").length;
    const active = queue.filter((item) =>
      ["creating_job", "uploading_cloud", "marking_uploaded", "queued"].includes(
        item.step
      )
    ).length;

    const averageProgress =
      queue.length === 0
        ? 0
        : Math.round(
            queue.reduce((sum, item) => sum + item.progress, 0) / queue.length
          );

    return {
      totalBytes,
      completed,
      failed,
      ready,
      active,
      averageProgress,
    };
  }, [queue]);

  useEffect(() => {
    const refDoc = doc(db, "analytics", "patientIndex");

    const unsubscribe = onSnapshot(
      refDoc,
      (snapshot) => {
        if (!snapshot.exists()) {
          setAnalyticsMissing(true);
          setStats(EMPTY_STATS);
        } else {
          setAnalyticsMissing(false);
          setStats(readPatientIndexStats(snapshot.data()));
        }

        setStatsLoading(false);
      },
      (error) => {
        console.error("PATIENT INDEX ANALYTICS SNAPSHOT ERROR:", error);
        toast.error("Could not load patient index stats.");
        setStatsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const recentJobsQuery = query(
      collection(db, "importJobs"),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      recentJobsQuery,
      (snapshot) => {
        setRecentJobs(
          snapshot.docs.map((jobDoc) =>
            normalizeRecentJob(jobDoc.id, jobDoc.data())
          )
        );
        setRecentJobsLoading(false);
      },
      (error) => {
        console.error("RECENT IMPORT JOBS SNAPSHOT ERROR:", error);
        setRecentJobs([]);
        setRecentJobsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  function updateQueueItem(localId: string, patch: Partial<QueuedUpload>) {
    setQueue((current) =>
      current.map((item) =>
        item.localId === localId ? { ...item, ...patch } : item
      )
    );
  }

  function handleAddFiles(files: FileList | null) {
    if (!files?.length) return;

    const incoming = Array.from(files);
    const remainingSlots = Math.max(MAX_FILES_PER_BATCH - queue.length, 0);

    if (remainingSlots <= 0) {
      toast.error(`Batch limit reached. Max ${MAX_FILES_PER_BATCH} files.`);
      return;
    }

    const accepted: QueuedUpload[] = [];
    const rejected: string[] = [];

    for (const file of incoming.slice(0, remainingSlots)) {
      const validationError = validateFile(file);

      if (validationError) {
        rejected.push(`${file.name}: ${validationError}`);
        continue;
      }

      accepted.push({
        localId: makeLocalId(),
        file,
        reportType: defaultReportType,
        step: "idle",
        progress: 0,
        jobId: "",
        storagePath: "",
        downloadURL: "",
        error: "",
      });
    }

    if (accepted.length) {
      setQueue((current) => [...current, ...accepted]);
      toast.success(`${accepted.length} file${accepted.length === 1 ? "" : "s"} added.`);
    }

    if (rejected.length) {
      toast.error(`${rejected.length} file${rejected.length === 1 ? "" : "s"} rejected.`);
      console.warn("Rejected upload files:", rejected);
    }

    const input = document.getElementById("report-file-input") as HTMLInputElement | null;
    if (input) input.value = "";
  }

  function clearCompleted() {
    setQueue((current) => current.filter((item) => item.step !== "complete"));
  }

  function resetQueue() {
    if (uploading) return;

    setQueue([]);
    setBatchMessage("");

    const input = document.getElementById("report-file-input") as HTMLInputElement | null;
    if (input) input.value = "";
  }

  function removeQueuedFile(localId: string) {
    if (uploading) return;
    setQueue((current) => current.filter((item) => item.localId !== localId));
  }

  function setReportTypeForAll(reportType: ReportType) {
    setDefaultReportType(reportType);

    setQueue((current) =>
      current.map((item) =>
        item.step === "idle" || item.step === "failed"
          ? { ...item, reportType }
          : item
      )
    );
  }

  async function uploadOne(item: QueuedUpload) {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("You must be logged in before uploading.");
    }

    const fileExtension = getFileExtension(item.file.name);

    if (!fileExtension) {
      throw new Error("Only CSV and PDF files are supported.");
    }

    const selectedOption = getReportOption(item.reportType);

    updateQueueItem(item.localId, {
      step: "creating_job",
      progress: 0,
      error: "",
      jobId: "",
      storagePath: "",
      downloadURL: "",
    });

    const jobRef = doc(collection(db, "importJobs"));
    const jobId = jobRef.id;

    const safeName = cleanFileName(item.file.name);
    const mimeType = getMimeType(item.file, fileExtension);
    const storagePath = `reports/uploads/${item.reportType}/${jobId}-${safeName}`;
    const storageRef = ref(storage, storagePath);

    updateQueueItem(item.localId, {
      jobId,
      storagePath,
    });

    await setDoc(jobRef, {
      id: jobId,

      reportType: item.reportType,
      reportLabel: selectedOption?.label ?? item.reportType,
      reportCategory: selectedOption?.category ?? "Uncategorized",

      originalFileName: item.file.name,
      safeFileName: safeName,
      fileType: fileExtension,
      mimeType,
      fileSize: item.file.size,

      storagePath,
      storageBucket: storage.app.options.storageBucket ?? "",
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

    updateQueueItem(item.localId, {
      step: "uploading_cloud",
    });

    const uploadTask = uploadBytesResumable(storageRef, item.file, {
      contentType: mimeType,
      customMetadata: {
        jobId,
        reportType: item.reportType,
        originalFileName: item.file.name,
        uploadedByUid: user.uid,
        uploadedByEmail: user.email ?? "",
      },
    });

    await new Promise<UploadTaskSnapshot>((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const percent =
            snapshot.totalBytes > 0
              ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
              : 0;

          updateQueueItem(item.localId, {
            progress: percent,
          });
        },
        reject,
        () => resolve(uploadTask.snapshot)
      );
    });

    const downloadURL = await getDownloadURL(storageRef);

    updateQueueItem(item.localId, {
      step: "marking_uploaded",
      downloadURL,
      progress: 100,
    });

    await setDoc(
      jobRef,
      {
        status: "uploaded",
        processingStatus: "queued_for_cloud_function",

        uploadedToCloud: true,
        cloudVerified: true,
        cloudUploadVerified: true,

        downloadURL,
        storagePath,
        storageBucket: storage.app.options.storageBucket ?? "",

        uploadedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    updateQueueItem(item.localId, {
      step: "complete",
      progress: 100,
      downloadURL,
      error: "",
    });
  }

  async function handleUploadBatch() {
    if (uploadLockRef.current || uploading) return;

    if (!queue.length) {
      toast.error("Add at least one CSV or PDF file first.");
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      toast.error("You must be logged in before uploading.");
      return;
    }

    const uploadable = queue.filter(
      (item) => item.step === "idle" || item.step === "failed"
    );

    if (!uploadable.length) {
      toast.error("No queued or failed files are ready to upload.");
      return;
    }

    uploadLockRef.current = true;
    setUploading(true);
    setBatchMessage("");

    let successCount = 0;
    let failCount = 0;

    try {
      for (const item of uploadable) {
        try {
          await uploadOne(item);
          successCount += 1;
        } catch (error) {
          failCount += 1;

          console.error("UPLOAD FILE ERROR:", error);

          updateQueueItem(item.localId, {
            step: "failed",
            error:
              error instanceof Error
                ? error.message
                : "Upload failed. Check Firebase Storage rules and permissions.",
          });
        }
      }

      if (successCount > 0) {
        toast.success(
          `${successCount} file${successCount === 1 ? "" : "s"} uploaded and queued.`
        );
      }

      if (failCount > 0) {
        toast.error(`${failCount} file${failCount === 1 ? "" : "s"} failed.`);
      }

      setBatchMessage(
        `Batch finished. Uploaded: ${successCount}. Failed: ${failCount}.`
      );
    } finally {
      uploadLockRef.current = false;
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white md:px-6">
      <div className="max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-950 via-neutral-950 to-blue-950/30 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3 text-blue-300">
                <FileUp className="h-6 w-6" aria-hidden="true" />
              </div>

              <div>
                <h1 className="text-2xl font-bold md:text-3xl">
                  Upload & Index Command Center
                </h1>

                <p className="mt-2 max-w-3xl text-sm text-neutral-400">
                  Upload one or many CSV/PDF reports, assign report types per file,
                  verify Firebase Storage, and queue Cloud Function processing.
                </p>

                <p className="mt-2 text-xs text-neutral-500">
                  Last patient index update: {formatTimestamp(stats.lastUpdatedAt)}
                </p>
              </div>
            </div>

            <Link
              href="/reports"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/20"
            >
              Back to Reports
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            label="Patients"
            value={statsLoading ? "Loading" : stats.patients.toLocaleString()}
            helper="Indexed patient profiles"
          />

          <StatCard
            icon={<HeartPulse className="h-5 w-5" aria-hidden="true" />}
            label="Hospice Patients"
            value={statsLoading ? "Loading" : stats.hospicePatients.toLocaleString()}
            helper="Hospice tracked"
            tone="rose"
          />

          <StatCard
            icon={<Wrench className="h-5 w-5" aria-hidden="true" />}
            label="Total WIPs"
            value={statsLoading ? "Loading" : stats.wipTotal.toLocaleString()}
            helper="Total work in progress"
            tone="blue"
          />

          <StatCard
            icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
            label="Open WIPs"
            value={statsLoading ? "Loading" : stats.wipOpen.toLocaleString()}
            helper="Needs attention"
            tone={stats.wipOpen > 0 ? "amber" : "neutral"}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
            label="Completed WIPs"
            value={statsLoading ? "Loading" : stats.wipCompleted.toLocaleString()}
            helper="Closed WIP records"
            tone="emerald"
          />

          <StatCard
            icon={<Activity className="h-5 w-5" aria-hidden="true" />}
            label="Living Hospice"
            value={statsLoading ? "Loading" : stats.hospiceLiving.toLocaleString()}
            helper="Living hospice patients"
            tone="emerald"
          />

          <StatCard
            icon={<HeartPulse className="h-5 w-5" aria-hidden="true" />}
            label="Deceased Hospice"
            value={statsLoading ? "Loading" : stats.hospiceDeceased.toLocaleString()}
            helper="Deceased hospice patients"
            tone="rose"
          />
        </section>

        {analyticsMissing ? (
          <section className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <div className="font-semibold">analytics/patientIndex is missing.</div>
                <p className="mt-1 text-amber-100/80">
                  Upload and process a report, or run your rebuild/backfill function.
                  This page will update automatically once the analytics document exists.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {batchMessage ? (
          <section className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-neutral-200">
            <p>{batchMessage}</p>
            <button
              type="button"
              onClick={() => setBatchMessage("")}
              className="rounded-lg p-1 text-neutral-400 hover:bg-white/10 hover:text-white"
              aria-label="Dismiss batch message"
              title="Dismiss batch message"
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
            </button>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
            <div className="grid gap-5">
              <div>
                <label
                  htmlFor="default-report-type"
                  className="mb-2 block text-sm text-neutral-300"
                >
                  Default Report Type
                </label>

                <select
                  id="default-report-type"
                  name="defaultReportType"
                  title="Default report type"
                  aria-label="Default report type"
                  value={defaultReportType}
                  onChange={(event) =>
                    setReportTypeForAll(event.target.value as ReportType)
                  }
                  disabled={uploading}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {Object.entries(groupedOptions).map(([category, options]) => (
                    <optgroup key={category} label={category}>
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <p className="mt-2 text-sm text-neutral-500">
                  {defaultSelectedOption?.patientImpact
                    ? "This default type can update indexed patient-related collections after cloud processing."
                    : "This default type will be stored as an import job and processed by your cloud pipeline."}
                </p>
              </div>

              <div>
                <label
                  htmlFor="report-file-input"
                  className="mb-2 block text-sm text-neutral-300"
                >
                  Add CSV/PDF Files
                </label>

                <input
                  id="report-file-input"
                  name="reportFiles"
                  title="Upload CSV or PDF reports"
                  aria-label="Upload CSV or PDF reports"
                  type="file"
                  multiple
                  accept=".csv,text/csv,.pdf,application/pdf"
                  disabled={uploading}
                  onChange={(event) => handleAddFiles(event.target.files)}
                  className="block w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white disabled:cursor-not-allowed disabled:opacity-60"
                />

                <p className="mt-2 text-xs text-neutral-500">
                  Batch limit: {MAX_FILES_PER_BATCH} files. Max file size:{" "}
                  {formatBytes(MAX_FILE_SIZE_BYTES)}.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <MiniStat label="Queued" value={queue.length.toLocaleString()} />
                <MiniStat label="Ready" value={batchStats.ready.toLocaleString()} />
                <MiniStat label="Complete" value={batchStats.completed.toLocaleString()} />
                <MiniStat label="Failed" value={batchStats.failed.toLocaleString()} />
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-neutral-300">
                <InfoLine
                  label="Default report"
                  value={defaultSelectedOption?.label ?? "-"}
                />
                <InfoLine
                  label="Default category"
                  value={defaultSelectedOption?.category ?? "-"}
                />
                <InfoLine label="Total batch size" value={formatBytes(batchStats.totalBytes)} />
                <InfoLine label="Active uploads" value={batchStats.active.toLocaleString()} />
                <InfoLine label="Average progress" value={`${batchStats.averageProgress}%`} />
              </div>

              {queue.length ? (
                <div className="rounded-2xl border border-white/10 bg-black/30">
                  <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="font-semibold">Upload Queue</h2>
                      <p className="text-sm text-neutral-500">
                        Assign report types per file before upload.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={clearCompleted}
                        disabled={uploading || batchStats.completed === 0}
                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-neutral-200 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Clear Completed
                      </button>

                      <button
                        type="button"
                        onClick={resetQueue}
                        disabled={uploading}
                        className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Clear Queue
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-white/10">
                    {queue.map((item) => (
                      <QueuedFileRow
                        key={item.localId}
                        item={item}
                        groupedOptions={groupedOptions}
                        disabled={uploading || item.step === "complete"}
                        onChangeReportType={(reportType) =>
                          updateQueueItem(item.localId, { reportType })
                        }
                        onRemove={() => removeQueuedFile(item.localId)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-neutral-500">
                  No files queued. Add one or more CSV/PDF files above.
                </div>
              )}

              {queue.length ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm text-neutral-300">
                    <span>Batch Progress</span>
                    <span>{batchStats.averageProgress}%</span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white transition-all"
                      style={{ width: `${batchStats.averageProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleUploadBatch()}
                  disabled={uploading || !queue.length || batchStats.ready === 0}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Uploading Batch...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      Upload Ready Files
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={resetQueue}
                  disabled={uploading || queue.length === 0}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                  Reset
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
              <h2 className="text-lg font-semibold">Upload Pipeline</h2>

              <div className="mt-5 space-y-3">
                <StepRow
                  label="Create import job in Firestore"
                  active={batchStats.active > 0}
                  done={batchStats.completed > 0}
                />

                <StepRow
                  label="Upload raw file to Firebase Storage"
                  active={uploading}
                  done={batchStats.completed > 0}
                />

                <StepRow
                  label="Verify cloud upload URL and storage path"
                  active={uploading}
                  done={batchStats.completed > 0}
                />

                <StepRow
                  label="Queue Cloud Function processing"
                  active={uploading}
                  done={batchStats.completed > 0}
                />

                <StepRow
                  label="Batch complete"
                  active={false}
                  done={queue.length > 0 && batchStats.completed === queue.length}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm text-blue-100/80">
                <div className="mb-2 flex items-center gap-2 font-medium text-blue-100">
                  <Cloud className="h-4 w-4" aria-hidden="true" />
                  Cloud-First Storage
                </div>
                Files go to Firebase Storage. Firestore stores metadata.
                Cloud Functions parse and index after upload.
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100/80">
                <div className="mb-2 flex items-center gap-2 font-medium text-emerald-100">
                  <Database className="h-4 w-4" aria-hidden="true" />
                  Analytics Source
                </div>
                Counts come from{" "}
                <code className="rounded bg-black/30 px-1">
                  analytics/patientIndex
                </code>
                .
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
              <h2 className="text-lg font-semibold">Recent Import Jobs</h2>

              <div className="mt-4 space-y-3">
                {recentJobsLoading ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-neutral-500">
                    Loading recent jobs...
                  </div>
                ) : recentJobs.length ? (
                  recentJobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-2xl border border-white/10 bg-black/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="line-clamp-1 text-sm font-semibold text-white">
                            {job.originalFileName || "Unnamed file"}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {job.reportLabel || job.reportType || "Unknown report"}
                          </p>
                        </div>

                        <JobStatusBadge status={job.status} />
                      </div>

                      <div className="mt-3 text-xs text-neutral-500">
                        <div>Processing: {job.processingStatus || "—"}</div>
                        <div>Uploaded by: {job.uploadedByEmail || "—"}</div>
                        <div>Created: {formatTimestamp(job.createdAt)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-neutral-500">
                    No recent import jobs found.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function QueuedFileRow({
  item,
  groupedOptions,
  disabled,
  onChangeReportType,
  onRemove,
}: {
  item: QueuedUpload;
  groupedOptions: ReturnType<typeof groupReportOptions>;
  disabled: boolean;
  onChangeReportType: (reportType: ReportType) => void;
  onRemove: () => void;
}) {
  const selectedOption = getReportOption(item.reportType);

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_0.9fr_0.7fr_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          <p className="truncate font-medium text-white">{item.file.name}</p>
          <StepBadge step={item.step} />
        </div>

        <p className="mt-1 text-xs text-neutral-500">
          {formatBytes(item.file.size)}
          {item.jobId ? ` • Job ${item.jobId}` : ""}
        </p>

        {item.error ? (
          <p className="mt-2 text-xs text-red-300">{item.error}</p>
        ) : null}

        {item.storagePath ? (
          <p className="mt-2 break-all text-xs text-neutral-600">
            {item.storagePath}
          </p>
        ) : null}
      </div>

      <label>
        <span className="mb-2 block text-xs text-neutral-400">Report Type</span>
        <select
          title={`Report type for ${item.file.name}`}
          aria-label={`Report type for ${item.file.name}`}
          value={item.reportType}
          onChange={(event) => onChangeReportType(event.target.value as ReportType)}
          disabled={disabled}
          className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {Object.entries(groupedOptions).map(([category, options]) => (
            <optgroup key={category} label={category}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <p className="mt-1 text-xs text-neutral-600">
          {selectedOption?.category ?? "Uncategorized"}
        </p>
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-neutral-400">
          <span>{getStepLabel(item.step)}</span>
          <span>{item.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white transition-all"
            style={{ width: `${item.progress}%` }}
          />
        </div>

        {item.downloadURL ? (
          <a
            href={item.downloadURL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-xs text-emerald-300 hover:text-emerald-200"
          >
            Open cloud file
          </a>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="inline-flex items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Remove ${item.file.name}`}
        title={`Remove ${item.file.name}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  helper,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  tone?: "neutral" | "amber" | "emerald" | "rose" | "blue";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
      : tone === "emerald"
        ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
        : tone === "rose"
          ? "border-red-400/20 bg-red-500/10 text-red-200"
          : tone === "blue"
            ? "border-blue-400/20 bg-blue-500/10 text-blue-200"
            : "border-white/10 bg-neutral-950 text-white";

  return (
    <div className={`rounded-3xl border p-5 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          {icon}
        </div>

        {value === "Loading" ? (
          <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
        ) : null}
      </div>

      <div className="mt-4 text-xs uppercase tracking-[0.2em] text-neutral-400">
        {label}
      </div>

      <div className="mt-2 text-3xl font-semibold">{value}</div>

      <div className="mt-2 text-sm text-neutral-500">{helper}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 break-words first:mt-0">
      <span className="text-neutral-500">{label}:</span> {value}
    </div>
  );
}

function StepRow({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-2xl border p-3 text-sm",
        done
          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
          : active
            ? "border-blue-400/20 bg-blue-500/10 text-blue-200"
            : "border-white/10 bg-black/30 text-neutral-400",
      ].join(" ")}
    >
      {done ? (
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      ) : active ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <div className="h-4 w-4 rounded-full border border-white/20" />
      )}

      {label}
    </div>
  );
}

function StepBadge({ step }: { step: UploadStep }) {
  const styles =
    step === "complete"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      : step === "failed"
        ? "border-red-400/20 bg-red-500/10 text-red-200"
        : step === "idle"
          ? "border-white/10 bg-white/10 text-neutral-300"
          : "border-blue-400/20 bg-blue-500/10 text-blue-200";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs ${styles}`}>
      {getStepLabel(step)}
    </span>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  const styles =
    normalized === "uploaded" || normalized === "complete"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      : normalized.includes("error") || normalized.includes("failed")
        ? "border-red-400/20 bg-red-500/10 text-red-200"
        : "border-blue-400/20 bg-blue-500/10 text-blue-200";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs ${styles}`}>
      {status || "unknown"}
    </span>
  );
}