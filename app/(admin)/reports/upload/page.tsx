"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileArchive,
  FileText,
  Filter,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type FirestoreError,
  type Timestamp,
} from "firebase/firestore";
import {
  deleteObject,
  ref,
  uploadBytesResumable,
  type UploadTaskSnapshot,
} from "firebase/storage";
import { httpsCallable } from "firebase/functions";

import { colors, glass, typography } from "@/theme";
import { db, functions, storage } from "@/lib/firebase";
import { useAuthRole } from "@/app/hooks/useAuthRole";

type ImportMode = "append" | "overwrite_report_type";

type QueueFilter =
  | "all"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "deleted";

type UploadStatus =
  | "idle"
  | "validating"
  | "creating_job"
  | "uploading"
  | "finalizing"
  | "complete"
  | "failed";

type ImportJobStatus =
  | "queued"
  | "uploaded"
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "deleted"
  | "unknown";

type ReportType =
  | "auto"
  | "patients"
  | "orders"
  | "hospice"
  | "insurance"
  | "wip"
  | "rentals"
  | "generic";

type RecentImportJob = {
  id: string;
  fileName: string;
  originalName?: string;
  reportType: ReportType | string;
  importMode: ImportMode | string;
  status: ImportJobStatus;
  storagePath?: string;
  contentType?: string;
  sizeBytes?: number;
  progress?: number;
  totalRows?: number;
  processedRows?: number;
  processedCount?: number;
  failedRows?: number;
  failedCount?: number;
  skippedRows?: number;
  completedWithErrors?: boolean;
  errorMessage?: string;
  createdByUid?: string;
  createdByEmail?: string;
  createdAt?: Timestamp | Date | string | null;
  updatedAt?: Timestamp | Date | string | null;
  completedAt?: Timestamp | Date | string | null;
};

type PatientIndexAnalytics = {
  totalPatients?: number;
  activePatients?: number;
  hospicePatients?: number;
  insuranceRecords?: number;
  lastIndexedAt?: Timestamp | Date | string | null;
  lastImportJobId?: string;
};

type UploadQueueItem = {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  jobId?: string;
  error?: string;
};

type AuthRoleState = {
  user?: {
    uid?: string;
    email?: string | null;
    displayName?: string | null;
  } | null;
  role?: string | null;
  loading?: boolean;
  isAdmin?: boolean;
  isStaff?: boolean;
  error?: string | Error | null;
};

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(["csv", "pdf"]);

const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/pdf",
  "text/plain",
  "",
]);

const ui = {
  page:
    "relative min-h-screen overflow-x-hidden bg-[#020617] text-slate-100",
  shell:
    "relative z-10 mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8",
  hero:
    "relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-2xl sm:p-8",
  panel:
    "relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/75 shadow-2xl shadow-black/25 backdrop-blur-2xl",
  card:
    "rounded-3xl border border-white/10 bg-white/[0.055] shadow-lg shadow-black/10 backdrop-blur-xl",
  badge:
    "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl",
  icon:
    "flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200 shadow-lg shadow-cyan-500/10 backdrop-blur-xl",
  input:
    "w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-100 outline-none backdrop-blur-xl placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20",
  buttonPrimary:
    "inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50",
  buttonGhost:
    "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-transparent px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50",
};

const REPORT_TYPES: Array<{ value: ReportType; label: string; helper: string }> =
  [
    {
      value: "auto",
      label: "Auto-detect",
      helper: "Let the backend route by filename and headers.",
    },
    {
      value: "patients",
      label: "Patients",
      helper: "Patient roster / PAR style exports.",
    },
    {
      value: "orders",
      label: "Orders",
      helper: "Sales orders, order detail, delivery rows.",
    },
    {
      value: "hospice",
      label: "Hospice",
      helper: "Hospice oversight and patient watchlists.",
    },
    {
      value: "insurance",
      label: "Insurance",
      helper: "Insurance records and payer exports.",
    },
    {
      value: "wip",
      label: "WIP",
      helper: "Work-in-progress operational queues.",
    },
    {
      value: "rentals",
      label: "Rentals",
      helper: "Rental equipment and active rental exports.",
    },
    {
      value: "generic",
      label: "Generic",
      helper: "Store safely when no processor should claim it.",
    },
  ];

const IMPORT_MODES: Array<{
  value: ImportMode;
  label: string;
  description: string;
}> = [
  {
    value: "append",
    label: "Append",
    description: "Add this upload without clearing existing report data.",
  },
  {
    value: "overwrite_report_type",
    label: "Overwrite report type",
    description:
      "Replace records for the selected report type during backend processing.",
  },
];

const QUEUE_FILTERS: Array<{ value: QueueFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "deleted", label: "Deleted" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.trim().toLowerCase() ?? "";
}

function sanitizeFileName(fileName: string) {
  const extension = getFileExtension(fileName);
  const baseName = fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  const safeBase = baseName || "report";
  return extension ? `${safeBase}.${extension}` : safeBase;
}

function validateUploadFile(file: File) {
  const extension = getFileExtension(file.name);

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return "Only CSV and PDF files are allowed.";
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return "Unsupported file type. Use a real CSV or PDF export.";
  }

  if (file.size <= 0) {
    return "This file is empty.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "File is too large. Keep uploads under 50 MB.";
  }

  return null;
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${
    units[index]
  }`;
}

function formatDate(value?: Timestamp | Date | string | null) {
  if (!value) return "—";

  const date =
    typeof value === "string"
      ? new Date(value)
      : value instanceof Date
      ? value
      : value.toDate();

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalizeJobStatus(value: unknown): ImportJobStatus {
  if (typeof value !== "string") return "unknown";

  const normalized = value.toLowerCase().trim().replaceAll("-", "_");

  if (
    normalized === "queued" ||
    normalized === "uploaded" ||
    normalized === "processing" ||
    normalized === "completed" ||
    normalized === "completed_with_errors" ||
    normalized === "failed" ||
    normalized === "deleted"
  ) {
    return normalized;
  }

  return "unknown";
}

function getStatusLabel(status: ImportJobStatus) {
  switch (status) {
    case "queued":
      return "Queued";
    case "uploaded":
      return "Uploaded";
    case "processing":
      return "Processing";
    case "completed":
      return "Completed";
    case "completed_with_errors":
      return "Completed with errors";
    case "failed":
      return "Failed";
    case "deleted":
      return "Deleted";
    default:
      return "Unknown";
  }
}

function getStatusIcon(status: ImportJobStatus) {
  switch (status) {
    case "completed":
      return CheckCircle2;
    case "completed_with_errors":
      return AlertTriangle;
    case "failed":
    case "deleted":
      return XCircle;
    case "processing":
    case "uploaded":
      return Loader2;
    default:
      return Clock3;
  }
}

function getStatusTone(status: ImportJobStatus) {
  switch (status) {
    case "completed":
      return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
    case "completed_with_errors":
      return "border-amber-300/25 bg-amber-400/10 text-amber-100";
    case "failed":
      return "border-rose-300/25 bg-rose-400/10 text-rose-100";
    case "deleted":
      return "border-zinc-300/20 bg-zinc-400/10 text-zinc-200";
    case "processing":
    case "uploaded":
      return "border-sky-300/25 bg-sky-400/10 text-sky-100";
    case "queued":
      return "border-violet-300/25 bg-violet-400/10 text-violet-100";
    default:
      return "border-white/15 bg-white/10 text-white/70";
  }
}

function readJob(id: string, data: DocumentData): RecentImportJob {
  return {
    id,
    fileName:
      String(data.fileName ?? data.originalName ?? data.name ?? "Untitled file") ||
      "Untitled file",
    originalName:
      typeof data.originalName === "string" ? data.originalName : undefined,
    reportType: String(data.reportType ?? "auto"),
    importMode: String(data.importMode ?? "append"),
    status: normalizeJobStatus(data.status),
    storagePath:
      typeof data.storagePath === "string" ? data.storagePath : undefined,
    contentType:
      typeof data.contentType === "string" ? data.contentType : undefined,
    sizeBytes: typeof data.sizeBytes === "number" ? data.sizeBytes : undefined,
    progress: typeof data.progress === "number" ? data.progress : undefined,
    totalRows: typeof data.totalRows === "number" ? data.totalRows : undefined,
    processedRows:
      typeof data.processedRows === "number" ? data.processedRows : undefined,
    processedCount:
      typeof data.processedCount === "number"
        ? data.processedCount
        : undefined,
    failedRows:
      typeof data.failedRows === "number" ? data.failedRows : undefined,
    failedCount:
      typeof data.failedCount === "number" ? data.failedCount : undefined,
    skippedRows:
      typeof data.skippedRows === "number" ? data.skippedRows : undefined,
    completedWithErrors:
      typeof data.completedWithErrors === "boolean"
        ? data.completedWithErrors
        : undefined,
    errorMessage:
      typeof data.errorMessage === "string" ? data.errorMessage : undefined,
    createdByUid:
      typeof data.createdByUid === "string" ? data.createdByUid : undefined,
    createdByEmail:
      typeof data.createdByEmail === "string" ? data.createdByEmail : undefined,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    completedAt: data.completedAt ?? null,
  };
}

function readPatientIndex(data: DocumentData | undefined): PatientIndexAnalytics {
  if (!data) return {};

  return {
    totalPatients:
      typeof data.totalPatients === "number"
        ? data.totalPatients
        : typeof data.patientCount === "number"
        ? data.patientCount
        : undefined,
    activePatients:
      typeof data.activePatients === "number"
        ? data.activePatients
        : typeof data.activePatientCount === "number"
        ? data.activePatientCount
        : undefined,
    hospicePatients:
      typeof data.hospicePatients === "number"
        ? data.hospicePatients
        : typeof data.hospicePatientCount === "number"
        ? data.hospicePatientCount
        : undefined,
    insuranceRecords:
      typeof data.insuranceRecords === "number"
        ? data.insuranceRecords
        : typeof data.insuranceRecordCount === "number"
        ? data.insuranceRecordCount
        : undefined,
    lastIndexedAt: data.lastIndexedAt ?? data.updatedAt ?? null,
    lastImportJobId:
      typeof data.lastImportJobId === "string" ? data.lastImportJobId : undefined,
  };
}

function isActiveUpload(status: UploadStatus) {
  return (
    status === "validating" ||
    status === "creating_job" ||
    status === "uploading" ||
    status === "finalizing"
  );
}

function uploadStatusLabel(status: UploadStatus) {
  switch (status) {
    case "validating":
      return "Validating";
    case "creating_job":
      return "Creating job";
    case "uploading":
      return "Uploading";
    case "finalizing":
      return "Finalizing";
    case "complete":
      return "Complete";
    case "failed":
      return "Failed";
    default:
      return "Idle";
  }
}

export default function UploadReportsPage() {
  const authRole = useAuthRole() as AuthRoleState;

  const user = authRole.user ?? null;
  const role = authRole.role ?? null;
  const roleLoading = Boolean(authRole.loading);
  const roleError =
    typeof authRole.error === "string"
      ? authRole.error
      : authRole.error?.message ?? null;

  const canManageUploads = Boolean(
    authRole.isAdmin || authRole.isStaff || role === "admin" || role === "staff"
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [reportType, setReportType] = useState<ReportType>("auto");
  const [importMode, setImportMode] = useState<ImportMode>("append");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [queueSearch, setQueueSearch] = useState("");

  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentImportJob[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [patientIndex, setPatientIndex] = useState<PatientIndexAnalytics>({});

  const [jobsLoading, setJobsLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [busyJobIds, setBusyJobIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const hasActiveUploads = useMemo(
    () => uploadQueue.some((item) => isActiveUpload(item.status)),
    [uploadQueue]
  );

  const selectedJobs = useMemo(
    () => recentJobs.filter((job) => selectedJobIds.has(job.id)),
    [recentJobs, selectedJobIds]
  );

  const filteredJobs = useMemo(() => {
    const search = queueSearch.trim().toLowerCase();

    return recentJobs.filter((job) => {
      const statusMatch =
        queueFilter === "all"
          ? true
          : queueFilter === "completed"
          ? job.status === "completed" || job.status === "completed_with_errors"
          : queueFilter === "failed"
          ? job.status === "failed"
          : queueFilter === "processing"
          ? job.status === "processing" || job.status === "uploaded"
          : job.status === queueFilter;

      if (!statusMatch) return false;

      if (!search) return true;

      const haystack = [
        job.fileName,
        job.originalName,
        job.reportType,
        job.importMode,
        job.status,
        job.createdByEmail,
        job.errorMessage,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [queueFilter, queueSearch, recentJobs]);

  const queueCounts = useMemo(() => {
    return recentJobs.reduce(
      (acc, job) => {
        acc.all += 1;

        if (job.status === "queued") acc.queued += 1;
        if (job.status === "processing" || job.status === "uploaded") {
          acc.processing += 1;
        }
        if (job.status === "completed" || job.status === "completed_with_errors") {
          acc.completed += 1;
        }
        if (job.status === "failed") acc.failed += 1;
        if (job.status === "deleted") acc.deleted += 1;

        return acc;
      },
      {
        all: 0,
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        deleted: 0,
      } satisfies Record<QueueFilter, number>
    );
  }, [recentJobs]);

  const uploadSummary = useMemo(() => {
    return uploadQueue.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.status === "complete") acc.complete += 1;
        if (item.status === "failed") acc.failed += 1;
        if (isActiveUpload(item.status)) acc.active += 1;
        return acc;
      },
      { total: 0, active: 0, complete: 0, failed: 0 }
    );
  }, [uploadQueue]);

  const updateUploadQueueItem = useCallback(
    (id: string, patch: Partial<UploadQueueItem>) => {
      setUploadQueue((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    },
    []
  );

  const writeAuditLog = useCallback(
    async (
      action: string,
      payload: Record<string, unknown> = {},
      severity: "info" | "warning" | "error" = "info"
    ) => {
      if (!user?.uid) return;

      try {
        await addDoc(collection(db, "auditLogs"), {
          action,
          area: "reports.upload",
          severity,
          actorUid: user.uid,
          actorEmail: user.email ?? null,
          actorRole: role ?? null,
          payload,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("[reports/upload] Failed to write audit log:", error);
      }
    },
    [role, user?.email, user?.uid]
  );

  const setJobBusy = useCallback((jobId: string, busy: boolean) => {
    setBusyJobIds((current) => {
      const next = new Set(current);
      if (busy) {
        next.add(jobId);
      } else {
        next.delete(jobId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!canManageUploads) {
      setJobsLoading(false);
      return undefined;
    }

    setJobsLoading(true);

    const jobsQuery = query(
      collection(db, "importJobs"),
      orderBy("createdAt", "desc"),
      limit(80)
    );

    const unsubscribe = onSnapshot(
      jobsQuery,
      (snapshot) => {
        setRecentJobs(snapshot.docs.map((item) => readJob(item.id, item.data())));
        setJobsLoading(false);
        setPageError(null);
      },
      (error: FirestoreError) => {
        console.error("[reports/upload] importJobs listener failed:", error);
        setPageError(error.message || "Unable to load recent import jobs.");
        setJobsLoading(false);
      }
    );

    return unsubscribe;
  }, [canManageUploads]);

  useEffect(() => {
    if (!canManageUploads) {
      setAnalyticsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPatientIndex() {
      setAnalyticsLoading(true);

      try {
        const primaryRef = doc(db, "analytics", "patientIndex");
        const fallbackRef = doc(db, "patientIndex", "summary");

        const primarySnap = await getDoc(primaryRef);

        if (!cancelled && primarySnap.exists()) {
          setPatientIndex(readPatientIndex(primarySnap.data()));
          return;
        }

        const fallbackSnap = await getDoc(fallbackRef);

        if (!cancelled) {
          setPatientIndex(
            fallbackSnap.exists() ? readPatientIndex(fallbackSnap.data()) : {}
          );
        }
      } catch (error) {
        console.error("[reports/upload] patientIndex analytics failed:", error);
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    }

    void loadPatientIndex();

    return () => {
      cancelled = true;
    };
  }, [canManageUploads]);

  const handleFilesSelected = useCallback((files: FileList | File[]) => {
    const selectedFiles = Array.from(files);

    if (!selectedFiles.length) return;

    const nextItems: UploadQueueItem[] = selectedFiles.map((file) => {
      const validationError = validateUploadFile(file);

      return {
        id: crypto.randomUUID(),
        file,
        status: validationError ? "failed" : "idle",
        progress: 0,
        error: validationError ?? undefined,
      };
    });

    setUploadQueue((current) => [...nextItems, ...current]);
  }, []);

  const uploadSingleFile = useCallback(
    async (item: UploadQueueItem) => {
      if (!canManageUploads || !user?.uid) {
        updateUploadQueueItem(item.id, {
          status: "failed",
          error: "You do not have permission to upload reports.",
        });
        return;
      }

      const validationError = validateUploadFile(item.file);

      if (validationError) {
        updateUploadQueueItem(item.id, {
          status: "failed",
          error: validationError,
          progress: 0,
        });
        return;
      }

      const safeFileName = sanitizeFileName(item.file.name);
      const extension = getFileExtension(safeFileName);
      const contentType =
        item.file.type ||
        (extension === "pdf" ? "application/pdf" : "text/csv");

      let jobId: string | undefined;

      try {
        updateUploadQueueItem(item.id, {
          status: "creating_job",
          progress: 0,
          error: undefined,
        });

        const jobRef = await addDoc(collection(db, "importJobs"), {
          fileName: safeFileName,
          originalName: item.file.name,
          reportType,
          importMode,
          status: "queued",
          progress: 0,
          sizeBytes: item.file.size,
          contentType,
          extension,
          createdByUid: user.uid,
          createdByEmail: user.email ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          source: "reports_upload_page",
        });

        jobId = jobRef.id;

        updateUploadQueueItem(item.id, {
          status: "uploading",
          jobId,
          progress: 0,
        });

        const storagePath = `reports/uploads/${jobId}/${safeFileName}`;
        const storageRef = ref(storage, storagePath);

        await new Promise<void>((resolve, reject) => {
          const uploadTask = uploadBytesResumable(storageRef, item.file, {
            contentType,
            customMetadata: {
              jobId: jobId ?? "",
              reportType: reportType ?? "generic",
              importMode: importMode ?? "append",
              originalName: item.file.name,
              uploadedByUid: user.uid ?? "",
              uploadedByEmail: user.email ?? "",
            },
          });

          uploadTask.on(
            "state_changed",
            (snapshot: UploadTaskSnapshot) => {
              const progress =
                snapshot.totalBytes > 0
                  ? Math.round(
                      (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                    )
                  : 0;

              updateUploadQueueItem(item.id, {
                status: "uploading",
                progress,
              });

              void setDoc(
                jobRef,
                {
                  progress,
                  uploadBytesTransferred: snapshot.bytesTransferred,
                  uploadTotalBytes: snapshot.totalBytes,
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
            },
            reject,
            () => resolve()
          );
        });

        updateUploadQueueItem(item.id, {
          status: "finalizing",
          progress: 100,
        });

        await updateDoc(jobRef, {
          status: "uploaded",
          progress: 100,
          storagePath,
          uploadedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await writeAuditLog("report_upload_completed", {
          jobId,
          fileName: safeFileName,
          originalName: item.file.name,
          reportType,
          importMode,
          sizeBytes: item.file.size,
          storagePath,
        });

        updateUploadQueueItem(item.id, {
          status: "complete",
          progress: 100,
          jobId,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed unexpectedly.";

        console.error("[reports/upload] upload failed:", error);

        updateUploadQueueItem(item.id, {
          status: "failed",
          progress: 0,
          jobId,
          error: message,
        });

        if (jobId) {
          try {
            await updateDoc(doc(db, "importJobs", jobId), {
              status: "failed",
              errorMessage: message,
              failedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (updateError) {
            console.error("[reports/upload] failed to mark job failed:", updateError);
          }
        }

        await writeAuditLog(
          "report_upload_failed",
          {
            jobId: jobId ?? null,
            fileName: safeFileName,
            originalName: item.file.name,
            reportType,
            importMode,
            sizeBytes: item.file.size,
            error: message,
          },
          "error"
        );
      }
    },
    [
      canManageUploads,
      importMode,
      reportType,
      updateUploadQueueItem,
      user?.email,
      user?.uid,
      writeAuditLog,
    ]
  );

  const handleStartUploads = useCallback(async () => {
    const pendingItems = uploadQueue.filter((item) => item.status === "idle");

    for (const item of pendingItems) {
      await uploadSingleFile(item);
    }
  }, [uploadQueue, uploadSingleFile]);

  const handleClearCompletedUploads = useCallback(() => {
    setUploadQueue((current) =>
      current.filter((item) => item.status !== "complete" && item.status !== "failed")
    );
  }, []);

  const handleRemoveQueuedUpload = useCallback((id: string) => {
    setUploadQueue((current) =>
      current.filter((item) => item.id !== id || isActiveUpload(item.status))
    );
  }, []);

  const refreshJob = useCallback(
    async (job: RecentImportJob) => {
      if (!canManageUploads) return;

      setJobBusy(job.id, true);

      try {
        await updateDoc(doc(db, "importJobs", job.id), {
          status: "queued",
          progress: 0,
          refreshRequestedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          errorMessage: null,
        });

        try {
          const reprocessImportJob = httpsCallable(functions, "reprocessImportJob");
          await reprocessImportJob({ jobId: job.id });
        } catch (callableError) {
          console.warn(
            "[reports/upload] reprocessImportJob callable unavailable or failed:",
            callableError
          );
        }

        await writeAuditLog("report_import_refresh_requested", {
          jobId: job.id,
          fileName: job.fileName,
          reportType: job.reportType,
          importMode: job.importMode,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to refresh import job.";

        console.error("[reports/upload] refresh failed:", error);
        setPageError(message);

        await writeAuditLog(
          "report_import_refresh_failed",
          {
            jobId: job.id,
            fileName: job.fileName,
            error: message,
          },
          "error"
        );
      } finally {
        setJobBusy(job.id, false);
      }
    },
    [canManageUploads, setJobBusy, writeAuditLog]
  );

  const deleteJob = useCallback(
    async (job: RecentImportJob) => {
      if (!canManageUploads) return;

      setJobBusy(job.id, true);

      try {
        if (job.storagePath) {
          try {
            await deleteObject(ref(storage, job.storagePath));
          } catch (storageError) {
            console.warn(
              "[reports/upload] storage object delete skipped/failed:",
              storageError
            );
          }
        }

        await setDoc(
          doc(db, "importJobs", job.id),
          {
            status: "deleted",
            deletedAt: serverTimestamp(),
            deletedByUid: user?.uid ?? null,
            deletedByEmail: user?.email ?? null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        await deleteDoc(doc(db, "importJobs", job.id));

        setSelectedJobIds((current) => {
          const next = new Set(current);
          next.delete(job.id);
          return next;
        });

        await writeAuditLog("report_import_deleted", {
          jobId: job.id,
          fileName: job.fileName,
          storagePath: job.storagePath ?? null,
          reportType: job.reportType,
          importMode: job.importMode,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to delete import job.";

        console.error("[reports/upload] delete failed:", error);
        setPageError(message);

        await writeAuditLog(
          "report_import_delete_failed",
          {
            jobId: job.id,
            fileName: job.fileName,
            error: message,
          },
          "error"
        );
      } finally {
        setJobBusy(job.id, false);
      }
    },
    [canManageUploads, setJobBusy, user?.email, user?.uid, writeAuditLog]
  );

  const handleRefreshSelected = useCallback(async () => {
    if (!selectedJobs.length) return;

    setBulkBusy(true);

    try {
      for (const job of selectedJobs) {
        await refreshJob(job);
      }
    } finally {
      setBulkBusy(false);
    }
  }, [refreshJob, selectedJobs]);

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedJobs.length) return;

    setBulkBusy(true);

    try {
      for (const job of selectedJobs) {
        await deleteJob(job);
      }
    } finally {
      setBulkBusy(false);
    }
  }, [deleteJob, selectedJobs]);

  const toggleSelectedJob = useCallback((jobId: string) => {
    setSelectedJobIds((current) => {
      const next = new Set(current);

      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }

      return next;
    });
  }, []);

  const toggleAllVisibleJobs = useCallback(() => {
    setSelectedJobIds((current) => {
      const next = new Set(current);
      const allVisibleSelected =
        filteredJobs.length > 0 && filteredJobs.every((job) => next.has(job.id));

      if (allVisibleSelected) {
        filteredJobs.forEach((job) => next.delete(job.id));
      } else {
        filteredJobs.forEach((job) => next.add(job.id));
      }

      return next;
    });
  }, [filteredJobs]);

  if (roleLoading) {
    return (
      <main className={cn(ui.page, colors.app)}>
        <div className={colors.grid} />
        <section className={cn(ui.shell, "min-h-[70vh] items-center justify-center")}>
          <div className={cn(ui.panel, "max-w-md p-8 text-center")}>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-200" />
            <h1 className={cn(typography.sectionTitle, "mt-4")}>
              Checking access
            </h1>
            <p className={cn(typography.bodyMuted, "mt-2")}>
              Verifying upload permissions before touching protected report data.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!canManageUploads) {
    return (
      <main className={cn(ui.page, colors.app)}>
        <div className={colors.grid} />
        <section className={cn(ui.shell, "min-h-[70vh] items-center justify-center")}>
          <div className={cn(ui.panel, "max-w-xl p-8 text-center")}>
            <div className={cn(ui.icon, "mx-auto")}>
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className={cn(typography.pageTitle, "mt-5")}>Access restricted</h1>
            <p className={cn(typography.bodyMuted, "mt-3")}>
              You need staff or admin permissions to upload reports.
            </p>
            {roleError ? (
              <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {roleError}
              </p>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={cn(ui.page, colors.app)}>
      <div className={colors.grid} />

      <section className={ui.shell}>
        <div className={ui.hero}>
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className={cn(ui.badge, "mb-4 w-fit")}>
                <UploadCloud className="h-3.5 w-3.5" />
                Reports Upload Center
              </div>

              <h1 className={typography.pageTitle}>Import Operations</h1>

              <p className={cn(typography.body, "mt-4 max-w-2xl")}>
                Upload CSV and PDF reports into Firebase Storage, queue import jobs,
                monitor processing, and keep the patient index clean.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
              {[
                ["Recent jobs", recentJobs.length],
                ["Processing", queueCounts.processing],
                ["Failed", queueCounts.failed],
                ["Queued", queueCounts.queued],
              ].map(([label, value]) => (
                <div key={label} className={cn(ui.card, "p-4")}>
                  <p className={typography.caption}>{label}</p>
                  <p className="mt-2 text-2xl font-black tracking-tight text-white">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {pageError ? (
          <div className="rounded-3xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm text-rose-100 shadow-2xl shadow-rose-950/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Upload center warning</p>
                <p className="mt-1 text-rose-100/80">{pageError}</p>
              </div>
              <button
                type="button"
                onClick={() => setPageError(null)}
                className={cn(ui.buttonGhost, "ml-auto px-3 py-2")}
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className={cn(ui.panel, "p-5 sm:p-6")}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className={cn(ui.badge, "mb-3 w-fit")}>
                  <FileArchive className="h-3.5 w-3.5" />
                  Batch upload
                </div>
                <h2 className={typography.sectionTitle}>Upload CSV/PDF reports</h2>
                <p className={cn(typography.bodyMuted, "mt-2 max-w-2xl")}>
                  Files are validated locally, uploaded with Firebase Storage
                  progress, then linked to importJobs for backend processing.
                </p>
              </div>

              <button
                type="button"
                className={ui.buttonPrimary}
                disabled={hasActiveUploads}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud className="h-4 w-4" />
                Choose files
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.pdf,text/csv,application/pdf"
                multiple
                className="hidden"
                onChange={(event) => {
                  if (event.target.files) {
                    handleFilesSelected(event.target.files);
                    event.target.value = "";
                  }
                }}
              />
            </div>

            <div
              className="mt-6 rounded-3xl border border-dashed border-white/20 bg-white/[0.045] p-8 text-center transition hover:border-sky-300/40 hover:bg-sky-300/[0.055]"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleFilesSelected(event.dataTransfer.files);
              }}
            >
              <div className={cn(ui.icon, "mx-auto")}>
                <UploadCloud className="h-6 w-6" />
              </div>
              <h3 className={cn(typography.cardTitle, "mt-4")}>
                Drop reports here
              </h3>
              <p className={cn(typography.bodyMuted, "mx-auto mt-2 max-w-xl")}>
                Supports batch CSV/PDF uploads up to 50 MB each.
              </p>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className={cn(ui.card, "block p-4")}>
                <span className={typography.label}>Report type</span>
                <div className="relative mt-2">
                  <select
                    value={reportType}
                    onChange={(event) =>
                      setReportType(event.target.value as ReportType)
                    }
                    className={cn(ui.input, "appearance-none pr-10")}
                    disabled={hasActiveUploads}
                  >
                    {REPORT_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                </div>
                <p className={cn(typography.bodyMuted, "mt-2 text-xs")}>
                  {REPORT_TYPES.find((item) => item.value === reportType)?.helper}
                </p>
              </label>

              <label className={cn(ui.card, "block p-4")}>
                <span className={typography.label}>Import mode</span>
                <div className="relative mt-2">
                  <select
                    value={importMode}
                    onChange={(event) =>
                      setImportMode(event.target.value as ImportMode)
                    }
                    className={cn(ui.input, "appearance-none pr-10")}
                    disabled={hasActiveUploads}
                  >
                    {IMPORT_MODES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                </div>
                <p className={cn(typography.bodyMuted, "mt-2 text-xs")}>
                  {
                    IMPORT_MODES.find((item) => item.value === importMode)
                      ?.description
                  }
                </p>
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid grid-cols-4 gap-2 text-center sm:min-w-[420px]">
                {[
                  ["Total", uploadSummary.total],
                  ["Active", uploadSummary.active],
                  ["Done", uploadSummary.complete],
                  ["Failed", uploadSummary.failed],
                ].map(([label, value]) => (
                  <div key={label} className={cn(ui.card, "p-3")}>
                    <p className={typography.caption}>{label}</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className={ui.buttonGhost}
                  onClick={handleClearCompletedUploads}
                  disabled={hasActiveUploads || uploadQueue.length === 0}
                >
                  <X className="h-4 w-4" />
                  Clear done
                </button>

                <button
                  type="button"
                  className={ui.buttonPrimary}
                  onClick={handleStartUploads}
                  disabled={
                    hasActiveUploads ||
                    uploadQueue.every((item) => item.status !== "idle")
                  }
                >
                  {hasActiveUploads ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}
                  Start upload
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {uploadQueue.length === 0 ? (
                <div className={cn(ui.card, "p-6 text-center")}>
                  <FileText className="mx-auto h-8 w-8 text-white/45" />
                  <p className={cn(typography.cardTitle, "mt-3")}>
                    No files queued
                  </p>
                  <p className={cn(typography.bodyMuted, "mt-1")}>
                    Add CSV or PDF reports to begin a batch upload.
                  </p>
                </div>
              ) : (
                uploadQueue.map((item) => (
                  <div key={item.id} className={cn(ui.card, "p-4")}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-sky-100" />
                          <p className="truncate font-semibold text-white">
                            {item.file.name}
                          </p>
                        </div>
                        <p className={cn(typography.bodyMuted, "mt-1 text-xs")}>
                          {formatBytes(item.file.size)} •{" "}
                          {item.file.type ||
                            getFileExtension(item.file.name).toUpperCase()}
                          {item.jobId ? ` • Job ${item.jobId}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            ui.badge,
                            item.status === "failed"
                              ? "border-rose-300/25 bg-rose-400/10 text-rose-100"
                              : item.status === "complete"
                              ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                              : "border-sky-300/25 bg-sky-400/10 text-sky-100"
                          )}
                        >
                          {isActiveUpload(item.status) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          {uploadStatusLabel(item.status)}
                        </span>

                        {!isActiveUpload(item.status) ? (
                          <button
                            type="button"
                            className={cn(ui.buttonGhost, "px-3 py-2")}
                            onClick={() => handleRemoveQueuedUpload(item.id)}
                            aria-label={`Remove ${item.file.name} from upload queue`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-300 via-cyan-200 to-emerald-200 transition-all duration-300"
                        style={{
                          width: `${Math.max(0, Math.min(item.progress, 100))}%`,
                        }}
                      />
                    </div>

                    {item.error ? (
                      <p className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
                        {item.error}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className={cn(ui.panel, "p-5")}>
              <div className="flex items-center gap-3">
                <div className={ui.icon}>
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className={typography.sectionTitle}>Patient index</h2>
                  <p className={cn(typography.bodyMuted, "text-sm")}>
                    Analytics cards from indexed patient data.
                  </p>
                </div>
              </div>

              {analyticsLoading ? (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-24 animate-pulse rounded-3xl bg-white/10"
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    ["Total patients", patientIndex.totalPatients ?? "—"],
                    ["Active", patientIndex.activePatients ?? "—"],
                    ["Hospice", patientIndex.hospicePatients ?? "—"],
                    ["Insurance", patientIndex.insuranceRecords ?? "—"],
                  ].map(([label, value]) => (
                    <div key={label} className={cn(ui.card, "p-4")}>
                      <p className={typography.caption}>{label}</p>
                      <p className="mt-2 text-2xl font-black tracking-tight text-white">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/60">
                Last indexed:{" "}
                <span className="text-white/80">
                  {formatDate(patientIndex.lastIndexedAt)}
                </span>
                {patientIndex.lastImportJobId ? (
                  <>
                    {" "}
                    • Job{" "}
                    <span className="text-white/80">
                      {patientIndex.lastImportJobId}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <div className={cn(ui.panel, "p-5")}>
              <div className="flex items-center gap-3">
                <div className={ui.icon}>
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className={typography.sectionTitle}>Upload rules</h2>
                  <p className={cn(typography.bodyMuted, "text-sm")}>
                    Guardrails before the backend gets involved.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  "CSV and PDF files only.",
                  "Each file must be under 50 MB.",
                  "Uploads write to Firebase Storage first.",
                  "Import jobs are tracked in Firestore.",
                  "Audit logs are written for upload, refresh, and delete actions.",
                ].map((rule) => (
                  <div
                    key={rule}
                    className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/75"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className={cn(ui.panel, "p-5 sm:p-6")}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className={cn(ui.badge, "mb-3 w-fit")}>
                <Activity className="h-3.5 w-3.5" />
                Import queue
              </div>
              <h2 className={typography.sectionTitle}>Recent import jobs</h2>
              <p className={cn(typography.bodyMuted, "mt-2")}>
                Search, filter, refresh, or delete import jobs.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                className={ui.buttonGhost}
                onClick={handleRefreshSelected}
                disabled={bulkBusy || selectedJobs.length === 0}
              >
                {bulkBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Refresh selected
              </button>

              <button
                type="button"
                className={cn(
                  ui.buttonGhost,
                  "border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15"
                )}
                onClick={handleDeleteSelected}
                disabled={bulkBusy || selectedJobs.length === 0}
              >
                {bulkBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete selected
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="relative block">
              <span className="sr-only">Search import queue</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <input
                value={queueSearch}
                onChange={(event) => setQueueSearch(event.target.value)}
                className={cn(ui.input, "pl-10")}
                placeholder="Search filename, type, status, user..."
              />
            </label>

            <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.035] p-1">
              <Filter className="ml-2 h-4 w-4 shrink-0 text-white/45" />
              {QUEUE_FILTERS.map((filter) => {
                const active = queueFilter === filter.value;

                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setQueueFilter(filter.value)}
                    className={cn(
                      "whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition",
                      active
                        ? "bg-white/15 text-white shadow-lg shadow-black/20"
                        : "text-white/55 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {filter.label}
                    <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                      {queueCounts[filter.value]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
            <div className="grid grid-cols-[44px_1.6fr_0.8fr_0.8fr_0.8fr_0.8fr_140px] gap-3 border-b border-white/10 bg-white/[0.045] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/45 max-xl:hidden">
              <button
                type="button"
                onClick={toggleAllVisibleJobs}
                className="flex h-5 w-5 items-center justify-center rounded border border-white/20 bg-white/5"
                aria-label="Select all visible jobs"
              >
                {filteredJobs.length > 0 &&
                filteredJobs.every((job) => selectedJobIds.has(job.id)) ? (
                  <CheckCircle2 className="h-4 w-4 text-sky-100" />
                ) : null}
              </button>
              <span>File</span>
              <span>Type</span>
              <span>Status</span>
              <span>Rows</span>
              <span>Created</span>
              <span className="text-right">Actions</span>
            </div>

            {jobsLoading ? (
              <div className="p-6">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-20 animate-pulse rounded-2xl bg-white/10"
                    />
                  ))}
                </div>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="p-10 text-center">
                <BarChart3 className="mx-auto h-9 w-9 text-white/35" />
                <p className={cn(typography.cardTitle, "mt-3")}>
                  No import jobs found
                </p>
                <p className={cn(typography.bodyMuted, "mt-1")}>
                  Adjust the search/filter or upload a report.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {filteredJobs.map((job) => {
                  const StatusIcon = getStatusIcon(job.status);
                  const busy = busyJobIds.has(job.id);
                  const selected = selectedJobIds.has(job.id);
                  const processed =
                    job.processedRows ?? job.processedCount ?? undefined;
                  const failed = job.failedRows ?? job.failedCount ?? undefined;

                  return (
                    <div
                      key={job.id}
                      className={cn(
                        "grid gap-3 px-4 py-4 transition hover:bg-white/[0.035]",
                        "xl:grid-cols-[44px_1.6fr_0.8fr_0.8fr_0.8fr_0.8fr_140px] xl:items-center",
                        selected && "bg-sky-400/[0.055]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 xl:block">
                        <button
                          type="button"
                          onClick={() => toggleSelectedJob(job.id)}
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition",
                            selected
                              ? "border-sky-200 bg-sky-300/20"
                              : "border-white/20 bg-white/5 hover:bg-white/10"
                          )}
                          aria-label={`Select import job ${job.fileName}`}
                        >
                          {selected ? (
                            <CheckCircle2 className="h-4 w-4 text-sky-100" />
                          ) : null}
                        </button>

                        <div className="flex gap-2 xl:hidden">
                          <button
                            type="button"
                            className={cn(ui.buttonGhost, "px-3 py-2")}
                            onClick={() => refreshJob(job)}
                            disabled={busy}
                            aria-label={`Refresh ${job.fileName}`}
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCcw className="h-4 w-4" />
                            )}
                          </button>

                          <button
                            type="button"
                            className={cn(
                              ui.buttonGhost,
                              "border-rose-300/20 bg-rose-500/10 px-3 py-2 text-rose-100"
                            )}
                            onClick={() => deleteJob(job)}
                            disabled={busy}
                            aria-label={`Delete ${job.fileName}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {job.fileName}
                        </p>
                        <p className={cn(typography.bodyMuted, "mt-1 text-xs")}>
                          {formatBytes(job.sizeBytes)} •{" "}
                          {job.createdByEmail ?? "Unknown user"}
                          {job.errorMessage ? ` • ${job.errorMessage}` : ""}
                        </p>
                      </div>

                      <div>
                        <span className={ui.badge}>{String(job.reportType)}</span>
                        <p className={cn(typography.bodyMuted, "mt-1 text-xs")}>
                          {String(job.importMode)}
                        </p>
                      </div>

                      <div>
                        <span className={cn(ui.badge, getStatusTone(job.status))}>
                          <StatusIcon
                            className={cn(
                              "h-3.5 w-3.5",
                              job.status === "processing" || job.status === "uploaded"
                                ? "animate-spin"
                                : ""
                            )}
                          />
                          {getStatusLabel(job.status)}
                        </span>

                        {typeof job.progress === "number" &&
                        job.status !== "completed" ? (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-sky-300 to-cyan-200"
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(job.progress, 100)
                                )}%`,
                              }}
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="text-sm text-white/70">
                        <p>
                          {processed ?? "—"}
                          {job.totalRows ? ` / ${job.totalRows}` : ""}
                        </p>
                        {failed ? (
                          <p className="mt-1 text-xs text-rose-100">
                            {failed} failed
                          </p>
                        ) : (
                          <p className={cn(typography.bodyMuted, "mt-1 text-xs")}>
                            {job.skippedRows ?? 0} skipped
                          </p>
                        )}
                      </div>

                      <div className="text-sm text-white/70">
                        <p>{formatDate(job.createdAt)}</p>
                        {job.completedAt ? (
                          <p className={cn(typography.bodyMuted, "mt-1 text-xs")}>
                            Done {formatDate(job.completedAt)}
                          </p>
                        ) : null}
                      </div>

                      <div className="hidden justify-end gap-2 xl:flex">
                        <button
                          type="button"
                          className={cn(ui.buttonGhost, "px-3 py-2")}
                          onClick={() => refreshJob(job)}
                          disabled={busy}
                          aria-label={`Refresh ${job.fileName}`}
                          title="Refresh job"
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="h-4 w-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          className={cn(
                            ui.buttonGhost,
                            "border-rose-300/20 bg-rose-500/10 px-3 py-2 text-rose-100 hover:bg-rose-500/15"
                          )}
                          onClick={() => deleteJob(job)}
                          disabled={busy}
                          aria-label={`Delete ${job.fileName}`}
                          title="Delete job"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}