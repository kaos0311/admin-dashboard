// app/(admin)/reports/upload/page.tsx

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  FileText,
  FileUp,
  HeartPulse,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  collection,
  deleteDoc,
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
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTaskSnapshot,
} from "firebase/storage";

import { useAuthRole } from "@/app/hooks/useAuthRole";
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

type QueueFilter = "all" | "ready" | "active" | "complete" | "failed";

type ImportMode = "append" | "overwrite_report_type";

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
  storagePath: string;
  downloadURL: string;
  importMode: string;
  refreshRequested: boolean;
  forceReprocess: boolean;
  reportVersion: number;
  weeklyBatchKey: string;
  progressPercent: number;
  rowsProcessed: number;
  rowsInserted: number;
  rowsFailed: number;
  processingStage: string;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
};

type ReportOptionLike = {
  value: ReportType;
  label: string;
  category?: string;
};

type GroupedReportOption = {
  category: string;
  options: ReportOptionLike[];
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
const STUCK_AFTER_MS = 1000 * 60 * 10;

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

function safeBoolean(value: unknown): boolean {
  return value === true;
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

function makeWeeklyBatchKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function fileSignature(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function isActiveStep(step: UploadStep): boolean {
  return ["creating_job", "uploading_cloud", "marking_uploaded", "queued"].includes(
    step
  );
}

function getStepLabel(step: UploadStep): string {
  if (step === "idle") return "Ready";
  if (step === "creating_job") return "Creating Job";
  if (step === "uploading_cloud") return "Uploading";
  if (step === "marking_uploaded") return "Verifying";
  if (step === "queued") return "Queued";
  if (step === "complete") return "Complete";

  return "Failed";
}

function validateFile(file: File): string {
  const extension = getFileExtension(file.name);

  if (!extension) return "Only CSV and PDF files are supported.";

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File is too large. Max allowed is ${formatBytes(
      MAX_FILE_SIZE_BYTES
    )}.`;
  }

  return "";
}

function isReportType(value: string | null): value is ReportType {
  if (!value) return false;

  return REPORT_TYPES.some((option) => {
    const maybeOption = option as unknown as {
      value?: string;
      type?: string;
      id?: string;
    };

    return (
      maybeOption.value === value ||
      maybeOption.type === value ||
      maybeOption.id === value
    );
  });
}

function readPatientIndexStats(
  data: DocumentData | undefined
): PatientIndexStats {
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
    storagePath: safeString(data.storagePath),
    downloadURL: safeString(data.downloadURL),
    importMode: safeString(data.importMode),
    refreshRequested: safeBoolean(data.refreshRequested),
    forceReprocess: safeBoolean(data.forceReprocess),
    reportVersion: safeNumber(data.reportVersion),
    weeklyBatchKey: safeString(data.weeklyBatchKey),
    progressPercent: safeNumber(data.progressPercent),
    rowsProcessed: safeNumber(data.rowsProcessed),
    rowsInserted: safeNumber(data.rowsInserted),
    rowsFailed: safeNumber(data.rowsFailed),
    processingStage: safeString(data.processingStage),
    createdAt: toTimestampLike(data.createdAt),
    updatedAt: toTimestampLike(data.updatedAt),
  };
}

function isJobStuck(job: RecentImportJob): boolean {
  if (!job.createdAt?.toDate) return false;

  const ageMs = Date.now() - job.createdAt.toDate().getTime();
  const combined = `${job.status} ${job.processingStatus}`.toLowerCase();

  return (
    ageMs > STUCK_AFTER_MS &&
    (combined.includes("waiting") ||
      combined.includes("created") ||
      combined.includes("queued"))
  );
}

function getJobProgressValue(job: RecentImportJob): number {
  const rawProgress = safeNumber(job.progressPercent);

  const combined =
    `${job.status} ${job.processingStatus} ${job.processingStage}`.toLowerCase();

  /*
    HARD COMPLETE STATES
  */
  if (
    combined.includes("complete") ||
    combined.includes("completed") ||
    combined.includes("success") ||
    combined.includes("finished") ||
    combined.includes("done") ||
    combined.includes("processors_completed")
  ) {
    return 100;
  }

  /*
    HARD FAILURE STATES
  */
  if (
    combined.includes("failed") ||
    combined.includes("error") ||
    combined.includes("crash") ||
    combined.includes("processor_failure")
  ) {
    return rawProgress > 0 ? rawProgress : 100;
  }

  /*
    REAL BACKEND PROGRESS
  */
  if (rawProgress > 0) {
    return Math.min(Math.max(rawProgress, 0), 100);
  }

  /*
    PIPELINE STATE ESTIMATES
  */

  // Upload complete / waiting for function
  if (
    combined.includes("queued_for_cloud_function") ||
    combined.includes("waiting_for_cloud_upload")
  ) {
    return 15;
  }

  // Cloud function started
  if (
    combined.includes("processing") ||
    combined.includes("running")
  ) {
    return 45;
  }

  // Processor stages
  if (combined.includes("patients")) {
    return 60;
  }

  if (combined.includes("orders")) {
    return 75;
  }

  if (combined.includes("hospice")) {
    return 85;
  }

  // Indexing / analytics
  if (
    combined.includes("index") ||
    combined.includes("analytics")
  ) {
    return 95;
  }

  /*
    Initial created state
  */
  if (
    combined.includes("created") ||
    combined.includes("waiting") ||
    combined.includes("queued")
  ) {
    return 5;
  }

  return 0;
}


function getProgressClass(step: UploadStep): string {
  if (step === "failed") return "progressTrack progressFailed";
  if (step === "complete") return "progressTrack progressCompleted";
  if (step === "queued") return "progressTrack progressWaiting";

  if (
    step === "creating_job" ||
    step === "uploading_cloud" ||
    step === "marking_uploaded"
  ) {
    return "progressTrack progressProcessing";
  }

  return "progressTrack";
}

function getJobProgressClass(job: RecentImportJob): string {
  const combined = `${job.status} ${job.processingStatus}`.toLowerCase();

  if (isJobStuck(job)) return "progressTrack progressStuck";
  if (combined.includes("failed") || combined.includes("error")) {
    return "progressTrack progressFailed";
  }
  if (combined.includes("complete") || combined.includes("completed")) {
    return "progressTrack progressCompleted";
  }
  if (combined.includes("waiting") || combined.includes("queue")) {
    return "progressTrack progressWaiting";
  }

  return "progressTrack progressProcessing";
}

function normalizeGroupedReportOptions(): GroupedReportOption[] {
  const grouped = groupReportOptions(REPORT_TYPES) as unknown;

  if (Array.isArray(grouped)) {
    return grouped.map((group) => {
      const maybeGroup = group as {
        category?: unknown;
        options?: unknown;
      };

      return {
        category:
          typeof maybeGroup.category === "string"
            ? maybeGroup.category
            : "Reports",
        options: Array.isArray(maybeGroup.options)
          ? (maybeGroup.options as ReportOptionLike[])
          : [],
      };
    });
  }

  if (typeof grouped === "object" && grouped !== null) {
    return Object.entries(grouped as Record<string, unknown>).map(
      ([category, options]) => ({
        category,
        options: Array.isArray(options) ? (options as ReportOptionLike[]) : [],
      })
    );
  }

  return [
    {
      category: "Reports",
      options: REPORT_TYPES.map((option) => {
        const raw = option as unknown as {
          value?: ReportType;
          type?: ReportType;
          id?: ReportType;
          label?: string;
          title?: string;
          category?: string;
        };

        const value = raw.value ?? raw.type ?? raw.id ?? DEFAULT_REPORT_TYPE;

        return {
          value,
          label: raw.label ?? raw.title ?? String(value),
          category: raw.category ?? "Reports",
        };
      }),
    },
  ];
}

export default function UploadReportPage() {
  const searchParams = useSearchParams();
  const requestedType = searchParams.get("type");

  const { canDeleteImports, canRefreshImports, canUploadReports, isAdmin } =
    useAuthRole();

  const [defaultReportType, setDefaultReportType] = useState<ReportType>(() =>
    isReportType(requestedType) ? requestedType : DEFAULT_REPORT_TYPE
  );

  const [importMode, setImportMode] = useState<ImportMode>("append");

  const [queue, setQueue] = useState<QueuedUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [dragActive, setDragActive] = useState(false);

  const [statsLoading, setStatsLoading] = useState(true);
  const [analyticsMissing, setAnalyticsMissing] = useState(false);
  const [stats, setStats] = useState<PatientIndexStats>(EMPTY_STATS);

  const [recentJobs, setRecentJobs] = useState<RecentImportJob[]>([]);
  const [recentJobsLoading, setRecentJobsLoading] = useState(true);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [deletingJobs, setDeletingJobs] = useState(false);
  const [refreshingJobs, setRefreshingJobs] = useState(false);

  const uploadLockRef = useRef(false);

  const groupedOptions = useMemo<GroupedReportOption[]>(() => {
    return normalizeGroupedReportOptions();
  }, []);

  const defaultSelectedOption = getReportOption(defaultReportType);

  useEffect(() => {
    if (!isReportType(requestedType)) return;

    setDefaultReportType(requestedType);

    setQueue((current) =>
      current.map((item) =>
        item.step === "idle" || item.step === "failed"
          ? { ...item, reportType: requestedType }
          : item
      )
    );
  }, [requestedType]);

  const batchStats = useMemo(() => {
    const totalBytes = queue.reduce((sum, item) => sum + item.file.size, 0);
    const completed = queue.filter((item) => item.step === "complete").length;
    const failed = queue.filter((item) => item.step === "failed").length;
    const ready = queue.filter((item) => item.step === "idle").length;
    const active = queue.filter((item) => isActiveStep(item.step)).length;

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
      hasUploadable: ready > 0 || failed > 0,
    };
  }, [queue]);

  const filteredQueue = useMemo(() => {
    const search = queueSearch.trim().toLowerCase();

    return queue.filter((item) => {
      const option = getReportOption(item.reportType);

      const matchesSearch =
        !search ||
        item.file.name.toLowerCase().includes(search) ||
        item.reportType.toLowerCase().includes(search) ||
        (option?.label ?? "").toLowerCase().includes(search);

      const matchesFilter =
        queueFilter === "all" ||
        (queueFilter === "ready" && item.step === "idle") ||
        (queueFilter === "active" && isActiveStep(item.step)) ||
        (queueFilter === "complete" && item.step === "complete") ||
        (queueFilter === "failed" && item.step === "failed");

      return matchesSearch && matchesFilter;
    });
  }, [queue, queueFilter, queueSearch]);

  const recentJobHealth = useMemo(() => {
    const failed = recentJobs.filter((job) => {
      const combined = `${job.status} ${job.processingStatus}`.toLowerCase();
      return combined.includes("failed") || combined.includes("error");
    }).length;

    const processing = recentJobs.filter((job) => {
      const combined = `${job.status} ${job.processingStatus}`.toLowerCase();
      return (
        combined.includes("queue") ||
        combined.includes("processing") ||
        combined.includes("waiting")
      );
    }).length;

    const stuck = recentJobs.filter((job) => isJobStuck(job)).length;

    return { failed, processing, stuck };
  }, [recentJobs]);

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
      limit(25)
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

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (!incoming.length) return;

    if (!canUploadReports) {
      toast.error("You do not have permission to upload reports.");
      return;
    }

    const existingSignatures = new Set(
      queue.map((item) => fileSignature(item.file))
    );

    const remainingSlots = Math.max(MAX_FILES_PER_BATCH - queue.length, 0);

    if (remainingSlots <= 0) {
      toast.error(`Batch limit reached. Max ${MAX_FILES_PER_BATCH} files.`);
      return;
    }

    const accepted: QueuedUpload[] = [];
    const rejected: string[] = [];
    let duplicates = 0;

    for (const file of incoming.slice(0, remainingSlots)) {
      if (existingSignatures.has(fileSignature(file))) {
        duplicates += 1;
        continue;
      }

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

      existingSignatures.add(fileSignature(file));
    }

    if (accepted.length) {
      setQueue((current) => [...current, ...accepted]);
      toast.success(
        `${accepted.length} file${accepted.length === 1 ? "" : "s"} added.`
      );
    }

    if (duplicates) {
      toast.error(
        `${duplicates} duplicate file${duplicates === 1 ? "" : "s"} skipped.`
      );
    }

    if (rejected.length) {
      toast.error(
        `${rejected.length} file${rejected.length === 1 ? "" : "s"} rejected.`
      );
      console.warn("Rejected upload files:", rejected);
    }
  }

  function handleAddFiles(files: FileList | null) {
    if (!files?.length) return;

    addFiles(files);

    const input = document.getElementById(
      "report-file-input"
    ) as HTMLInputElement | null;

    if (input) input.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);

    if (uploading) return;

    addFiles(event.dataTransfer.files);
  }

  function clearCompleted() {
    setQueue((current) => current.filter((item) => item.step !== "complete"));
  }

  function clearFailed() {
    setQueue((current) => current.filter((item) => item.step !== "failed"));
  }

  function retryFailed() {
    setQueue((current) =>
      current.map((item) =>
        item.step === "failed"
          ? {
              ...item,
              step: "idle",
              progress: 0,
              error: "",
              jobId: "",
              storagePath: "",
              downloadURL: "",
            }
          : item
      )
    );
  }

  function resetQueue() {
    if (uploading) return;

    setQueue([]);
    setBatchMessage("");
    setQueueSearch("");
    setQueueFilter("all");

    const input = document.getElementById(
      "report-file-input"
    ) as HTMLInputElement | null;

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

  function toggleJobSelection(jobId: string) {
    setSelectedJobIds((current) => {
      const next = new Set(current);

      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }

      return next;
    });
  }

  function selectAllRecentJobs() {
    setSelectedJobIds(new Set(recentJobs.map((job) => job.id)));
  }

  function clearJobSelection() {
    setSelectedJobIds(new Set());
  }

  async function writeAuditLog(
    action: string,
    details: Record<string, unknown>
  ) {
    const user = auth.currentUser;

    await setDoc(doc(collection(db, "auditLogs")), {
      action,
      actorUid: user?.uid ?? null,
      actorEmail: user?.email ?? null,
      targetUid: null,
      targetEmail: null,
      details,
      createdAt: serverTimestamp(),
    });
  }

  async function uploadOne(item: QueuedUpload) {
    const user = auth.currentUser;

    if (!user) throw new Error("You must be logged in before uploading.");

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

    const now = new Date();
    const reportVersion = now.getTime();
    const weeklyBatchKey = makeWeeklyBatchKey(now);

    updateQueueItem(item.localId, {
      jobId,
      storagePath,
    });

    await setDoc(jobRef, {
      id: jobId,

      reportType: item.reportType,
      reportLabel: selectedOption?.label ?? item.reportType,
      reportCategory: selectedOption?.category ?? "Uncategorized",

      importMode,
      overwriteExistingData: importMode === "overwrite_report_type",
      replaceScope: importMode === "overwrite_report_type" ? "reportType" : "none",
      forceReprocess: false,

      reportVersion,
      weeklyBatchKey,

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

      progressPercent: 0,
      processingStage: "waiting_for_cloud_upload",
      rowsProcessed: 0,
      rowsInserted: 0,
      rowsFailed: 0,

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
        importMode,
        reportVersion: String(reportVersion),
        weeklyBatchKey,
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
              ? Math.round(
                  (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                )
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
        processingStage: "queued_for_cloud_function",
        progressPercent: 5,

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

    await writeAuditLog("import_job_uploaded", {
      jobId,
      reportType: item.reportType,
      importMode,
      reportVersion,
      weeklyBatchKey,
      originalFileName: item.file.name,
      storagePath,
    });

    updateQueueItem(item.localId, {
      step: "complete",
      progress: 100,
      downloadURL,
      error: "",
    });
  }

  async function handleUploadBatch() {
    if (uploadLockRef.current || uploading) return;

    if (!canUploadReports) {
      toast.error("You do not have permission to upload reports.");
      return;
    }

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

  async function deleteImportJob(job: RecentImportJob) {
    if (deletingJobs || refreshingJobs) return;

    if (!canDeleteImports) {
      toast.error("Only admins can delete imports.");
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      toast.error("You must be logged in before deleting imports.");
      return;
    }

    setDeletingJobs(true);

    let storageDeleteFailed = false;

    try {
      if (job.storagePath) {
        try {
          await deleteObject(ref(storage, job.storagePath));
        } catch (error) {
          storageDeleteFailed = true;
          console.warn("Storage file delete skipped or failed:", error);
        }
      }

      await deleteDoc(doc(db, "importJobs", job.id));

      await writeAuditLog("import_job_deleted", {
        jobId: job.id,
        reportType: job.reportType,
        originalFileName: job.originalFileName,
        storagePath: job.storagePath,
        storageDeleteFailed,
      });

      toast.success(
        storageDeleteFailed
          ? "Import deleted. Storage cleanup failed."
          : "Import deleted."
      );

      setSelectedJobIds((current) => {
        const next = new Set(current);
        next.delete(job.id);
        return next;
      });
    } catch (error) {
      console.error("DELETE IMPORT JOB ERROR:", error);
      toast.error("Delete failed. Check Firestore and Storage rules.");
    } finally {
      setDeletingJobs(false);
    }
  }

  async function deleteSelectedJobs() {
    if (deletingJobs || refreshingJobs) return;

    if (!canDeleteImports) {
      toast.error("Only admins can delete imports.");
      return;
    }

    const selected = recentJobs.filter((job) => selectedJobIds.has(job.id));

    if (!selected.length) {
      toast.error("Select at least one import job first.");
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      toast.error("You must be logged in before deleting imports.");
      return;
    }

    setDeletingJobs(true);

    let deleted = 0;
    let failed = 0;
    let storageCleanupFailures = 0;

    try {
      for (const job of selected) {
        try {
          let storageDeleteFailed = false;

          if (job.storagePath) {
            try {
              await deleteObject(ref(storage, job.storagePath));
            } catch (error) {
              storageDeleteFailed = true;
              storageCleanupFailures += 1;
              console.warn("Storage file delete skipped or failed:", error);
            }
          }

          await deleteDoc(doc(db, "importJobs", job.id));

          await writeAuditLog("import_job_deleted", {
            jobId: job.id,
            reportType: job.reportType,
            originalFileName: job.originalFileName,
            storagePath: job.storagePath,
            storageDeleteFailed,
          });

          deleted += 1;
        } catch (error) {
          console.error("BATCH DELETE IMPORT JOB ERROR:", error);
          failed += 1;
        }
      }

      if (deleted) {
        toast.success(`${deleted} import${deleted === 1 ? "" : "s"} deleted.`);
      }

      if (storageCleanupFailures) {
        toast.error(`${storageCleanupFailures} storage cleanup issue(s).`);
      }

      if (failed) {
        toast.error(`${failed} delete${failed === 1 ? "" : "s"} failed.`);
      }

      setSelectedJobIds(new Set());
    } finally {
      setDeletingJobs(false);
    }
  }

  async function refreshImportJob(job: RecentImportJob) {
    if (deletingJobs || refreshingJobs) return;

    if (!canRefreshImports) {
      toast.error("You do not have permission to refresh imports.");
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      toast.error("You must be logged in before refreshing imports.");
      return;
    }

    setRefreshingJobs(true);

    try {
      await setDoc(
        doc(db, "importJobs", job.id),
        {
          status: "uploaded",
          processingStatus: "queued_for_cloud_function",
          processingStage: "queued_for_cloud_function",
          progressPercent: 5,

          refreshRequested: true,
          forceReprocess: true,
          refreshRequestedAt: serverTimestamp(),
          refreshedByUid: user.uid,
          refreshedByEmail: user.email ?? null,
          retryCount: Date.now(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await writeAuditLog("import_job_refreshed", {
        jobId: job.id,
        reportType: job.reportType,
        originalFileName: job.originalFileName,
        storagePath: job.storagePath,
        forceReprocess: true,
      });

      toast.success("Import refreshed and requeued.");
    } catch (error) {
      console.error("REFRESH IMPORT JOB ERROR:", error);
      toast.error("Refresh failed. Check Firestore rules.");
    } finally {
      setRefreshingJobs(false);
    }
  }

  async function refreshSelectedJobs() {
    if (deletingJobs || refreshingJobs) return;

    if (!canRefreshImports) {
      toast.error("You do not have permission to refresh imports.");
      return;
    }

    const selected = recentJobs.filter((job) => selectedJobIds.has(job.id));

    if (!selected.length) {
      toast.error("Select at least one import job first.");
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      toast.error("You must be logged in before refreshing imports.");
      return;
    }

    setRefreshingJobs(true);

    let refreshed = 0;
    let failed = 0;

    try {
      for (const job of selected) {
        try {
          await setDoc(
            doc(db, "importJobs", job.id),
            {
              status: "uploaded",
              processingStatus: "queued_for_cloud_function",
              processingStage: "queued_for_cloud_function",
              progressPercent: 5,

              refreshRequested: true,
              forceReprocess: true,
              refreshRequestedAt: serverTimestamp(),
              refreshedByUid: user.uid,
              refreshedByEmail: user.email ?? null,
              retryCount: Date.now(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          await writeAuditLog("import_job_refreshed", {
            jobId: job.id,
            reportType: job.reportType,
            originalFileName: job.originalFileName,
            storagePath: job.storagePath,
            forceReprocess: true,
          });

          refreshed += 1;
        } catch (error) {
          console.error("BATCH REFRESH IMPORT JOB ERROR:", error);
          failed += 1;
        }
      }

      if (refreshed) {
        toast.success(
          `${refreshed} import${refreshed === 1 ? "" : "s"} refreshed.`
        );
      }

      if (failed) {
        toast.error(`${failed} refresh${failed === 1 ? "" : "es"} failed.`);
      }
    } finally {
      setRefreshingJobs(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white md:px-6">
      <style jsx global>{`
        .progressTrack {
          width: 100%;
          height: 0.55rem;
          overflow: hidden;
          appearance: none;
          border: 0;
          border-radius: 9999px;
          background: rgb(255 255 255 / 0.06);
          box-shadow:
            inset 0 1px 2px rgb(0 0 0 / 0.45),
            0 0 0 1px rgb(255 255 255 / 0.04);
        }

        .progressTrack::-webkit-progress-bar {
          border-radius: 9999px;
          background: rgb(255 255 255 / 0.06);
        }

        .progressTrack::-webkit-progress-value {
          border-radius: 9999px;
          transition:
            width 180ms ease,
            background 180ms ease,
            box-shadow 180ms ease;
        }

        .progressTrack::-moz-progress-bar {
          border-radius: 9999px;
          transition:
            width 180ms ease,
            background 180ms ease,
            box-shadow 180ms ease;
        }

        .progressProcessing::-webkit-progress-value {
          background: linear-gradient(90deg, rgb(34 211 238), rgb(59 130 246));
          box-shadow: 0 0 8px rgb(34 211 238 / 0.35);
        }

        .progressProcessing::-moz-progress-bar {
          background: linear-gradient(90deg, rgb(34 211 238), rgb(59 130 246));
          box-shadow: 0 0 8px rgb(34 211 238 / 0.35);
        }

        .progressCompleted::-webkit-progress-value {
          background: linear-gradient(90deg, rgb(16 185 129), rgb(110 231 183));
          box-shadow: 0 0 10px rgb(16 185 129 / 0.35);
        }

        .progressCompleted::-moz-progress-bar {
          background: linear-gradient(90deg, rgb(16 185 129), rgb(110 231 183));
          box-shadow: 0 0 10px rgb(16 185 129 / 0.35);
        }

        .progressFailed::-webkit-progress-value {
          background: linear-gradient(90deg, rgb(239 68 68), rgb(248 113 113));
          box-shadow: 0 0 10px rgb(239 68 68 / 0.35);
        }

        .progressFailed::-moz-progress-bar {
          background: linear-gradient(90deg, rgb(239 68 68), rgb(248 113 113));
          box-shadow: 0 0 10px rgb(239 68 68 / 0.35);
        }

        .progressWaiting::-webkit-progress-value {
          background: linear-gradient(90deg, rgb(245 158 11), rgb(252 211 77));
          box-shadow: 0 0 10px rgb(245 158 11 / 0.3);
        }

        .progressWaiting::-moz-progress-bar {
          background: linear-gradient(90deg, rgb(245 158 11), rgb(252 211 77));
          box-shadow: 0 0 10px rgb(245 158 11 / 0.3);
        }

        .progressStuck::-webkit-progress-value {
          background: linear-gradient(90deg, rgb(168 85 247), rgb(192 132 252));
          box-shadow: 0 0 10px rgb(168 85 247 / 0.35);
        }

        .progressStuck::-moz-progress-bar {
          background: linear-gradient(90deg, rgb(168 85 247), rgb(192 132 252));
          box-shadow: 0 0 10px rgb(168 85 247 / 0.35);
        }
      `}</style>

      <div className="mx-auto max-w-[1800px] space-y-6">
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
                  Upload CSV/PDF reports, classify them, refresh stuck jobs,
                  overwrite weekly report data, and keep batch uploading without
                  turning the database into soup.
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

        {!canUploadReports ? (
          <section className="rounded-3xl border border-red-400/20 bg-red-500/10 p-5 text-sm text-red-100">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold">Upload access blocked</div>
                <p className="mt-1 text-red-100/80">
                  Your account does not currently have permission to upload
                  reports.
                </p>
              </div>
            </div>
          </section>
        ) : null}

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
            value={
              statsLoading ? "Loading" : stats.hospicePatients.toLocaleString()
            }
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

        {analyticsMissing ? (
          <section className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold">
                  analytics/patientIndex is missing
                </div>
                <p className="mt-1 text-amber-100/80">
                  Uploads will still queue, but analytics cards may stay empty
                  until your indexing function builds this document.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_420px]">
          <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Upload Files</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Choose the report type, choose the import behavior, drop files,
                  and upload the batch.
                </p>
              </div>

              <div className="grid w-full gap-3 md:grid-cols-2 xl:w-[680px]">
                <div>
                  <label
                    htmlFor="default-report-type"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
                  >
                    Default Report Type
                  </label>

                  <select
                    id="default-report-type"
                    value={defaultReportType}
                    disabled={uploading || !canUploadReports}
                    onChange={(event) =>
                      setReportTypeForAll(event.target.value as ReportType)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {groupedOptions.map((group) => (
                      <optgroup key={group.category} label={group.category}>
                        {group.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="import-mode"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
                  >
                    Import Mode
                  </label>

                  <select
                    id="import-mode"
                    value={importMode}
                    disabled={uploading || !canUploadReports}
                    onChange={(event) =>
                      setImportMode(event.target.value as ImportMode)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="append">Append new data</option>
                    <option value="overwrite_report_type">
                      Overwrite existing data for report type
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div
              className={`mt-5 rounded-2xl border p-4 text-sm ${
                importMode === "overwrite_report_type"
                  ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
                  : "border-white/10 bg-black/30 text-neutral-400"
              }`}
            >
              {importMode === "overwrite_report_type"
                ? "Overwrite mode is on. Your Cloud Function must delete old rows for this report type before inserting the new weekly report."
                : "Append mode is on. New imports will be added without replacing previous rows."}
            </div>

            <label
              htmlFor="report-file-input"
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed p-10 text-center transition ${
                dragActive
                  ? "border-blue-400 bg-blue-500/10"
                  : "border-white/10 bg-black/30 hover:bg-white/[0.04]"
              } ${!canUploadReports ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <Cloud className="h-10 w-10 text-blue-300" aria-hidden="true" />

              <div className="mt-4 text-lg font-semibold">
                Drop CSV/PDF files here
              </div>

              <p className="mt-2 max-w-xl text-sm text-neutral-400">
                Files upload to Firebase Storage, create import job records,
                and wait for Cloud Function processing.
              </p>

              <p className="mt-2 text-xs text-neutral-500">
                Max {MAX_FILES_PER_BATCH} files per batch · Max{" "}
                {formatBytes(MAX_FILE_SIZE_BYTES)} per file
              </p>

              <input
                id="report-file-input"
                type="file"
                multiple
                accept=".csv,.pdf,text/csv,application/pdf"
                disabled={uploading || !canUploadReports}
                onChange={(event) => handleAddFiles(event.target.files)}
                className="sr-only"
              />
            </label>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleUploadBatch()}
                disabled={
                  uploading || !batchStats.hasUploadable || !canUploadReports
                }
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? "Uploading..." : "Upload Batch"}
              </button>

              <button
                type="button"
                onClick={retryFailed}
                disabled={uploading || batchStats.failed === 0}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Retry Failed
              </button>

              <button
                type="button"
                onClick={clearCompleted}
                disabled={uploading || batchStats.completed === 0}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear Complete
              </button>

              <button
                type="button"
                onClick={clearFailed}
                disabled={uploading || batchStats.failed === 0}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear Failed
              </button>

              <button
                type="button"
                onClick={resetQueue}
                disabled={uploading || queue.length === 0}
                className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset Queue
              </button>
            </div>

            {batchMessage ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-300">
                {batchMessage}
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
            <h2 className="text-lg font-semibold">Batch Health</h2>

            <div className="mt-4 grid gap-3">
              <MiniStat label="Queued Files" value={queue.length} />
              <MiniStat label="Ready" value={batchStats.ready} />
              <MiniStat label="Active" value={batchStats.active} />
              <MiniStat label="Complete" value={batchStats.completed} />
              <MiniStat label="Failed" value={batchStats.failed} />
              <MiniStat label="Total Size" value={formatBytes(batchStats.totalBytes)} />
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Average Progress</span>
                <span>{batchStats.averageProgress}%</span>
              </div>

              <progress
                value={batchStats.averageProgress}
                max={100}
                className="progressTrack progressProcessing mt-2"
              />
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="text-sm font-medium">Selected Default Report</div>
              <p className="mt-1 text-sm text-neutral-400">
                {defaultSelectedOption?.label ?? defaultReportType}
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="text-sm font-medium">Current Import Mode</div>
              <p className="mt-1 text-sm text-neutral-400">
                {importMode === "overwrite_report_type"
                  ? "Overwrite weekly report data"
                  : "Append new data"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Upload Queue</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Review report types before uploading. Do not trust file names.
                Humans named them.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative block">
                <span className="sr-only">Search queued files</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <input
                  value={queueSearch}
                  onChange={(event) => setQueueSearch(event.target.value)}
                  placeholder="Search queue..."
                  className="w-full rounded-2xl border border-white/10 bg-black py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-blue-400 sm:w-72"
                />
              </label>

              <label>
                <span className="sr-only">Filter upload queue</span>
                <select
                  value={queueFilter}
                  onChange={(event) =>
                    setQueueFilter(event.target.value as QueueFilter)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 sm:w-44"
                >
                  <option value="all">All</option>
                  <option value="ready">Ready</option>
                  <option value="active">Active</option>
                  <option value="complete">Complete</option>
                  <option value="failed">Failed</option>
                </select>
              </label>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {filteredQueue.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-sm text-neutral-500">
                No files in this view.
              </div>
            ) : (
              filteredQueue.map((item) => {
                const option = getReportOption(item.reportType);
                const active = isActiveStep(item.step);

                return (
                  <div
                    key={item.localId}
                    className="rounded-2xl border border-white/10 bg-black/30 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-300" />
                          <p className="truncate font-medium">{item.file.name}</p>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-neutral-400">
                            {formatBytes(item.file.size)}
                          </span>
                          <StatusBadge step={item.step} />
                        </div>

                        <p className="mt-1 text-xs text-neutral-500">
                          {item.jobId ? `Job: ${item.jobId}` : "No job created yet"}
                        </p>

                        {item.error ? (
                          <p className="mt-2 text-sm text-red-300">{item.error}</p>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <label>
                          <span className="sr-only">
                            Report type for {item.file.name}
                          </span>
                          <select
                            value={item.reportType}
                            disabled={uploading || active || item.step === "complete"}
                            onChange={(event) =>
                              updateQueueItem(item.localId, {
                                reportType: event.target.value as ReportType,
                              })
                            }
                            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-2 text-sm text-white outline-none transition focus:border-blue-400 sm:w-64"
                          >
                            {groupedOptions.map((group) => (
                              <optgroup key={group.category} label={group.category}>
                                {group.options.map((reportOption) => (
                                  <option
                                    key={reportOption.value}
                                    value={reportOption.value}
                                  >
                                    {reportOption.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </label>

                        <button
                          type="button"
                          onClick={() => removeQueuedFile(item.localId)}
                          disabled={uploading || active}
                          className="inline-flex items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 p-2 text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Remove ${item.file.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-neutral-500">
                        <span>{option?.label ?? item.reportType}</span>
                        <span>{item.progress}%</span>
                      </div>

                      <progress
                        value={item.progress}
                        max={100}
                        className={`${getProgressClass(item.step)} mt-2`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
            <h2 className="text-lg font-semibold">Recent Import Health</h2>

            <div className="mt-4 grid gap-3">
              <MiniStat label="Recent Jobs" value={recentJobs.length} />
              <MiniStat label="Processing" value={recentJobHealth.processing} />
              <MiniStat label="Stuck / Waiting" value={recentJobHealth.stuck} />
              <MiniStat label="Failed" value={recentJobHealth.failed} />
              <MiniStat label="Selected" value={selectedJobIds.size} />
            </div>

            {!isAdmin ? (
              <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                Staff can refresh uploads, but only admins can delete imports.
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Recent Import Jobs</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Last 25 jobs from Firestore importJobs.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllRecentJobs}
                  disabled={
                    recentJobsLoading ||
                    deletingJobs ||
                    refreshingJobs ||
                    recentJobs.length === 0
                  }
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Select All
                </button>

                <button
                  type="button"
                  onClick={clearJobSelection}
                  disabled={
                    deletingJobs || refreshingJobs || selectedJobIds.size === 0
                  }
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={() => void refreshSelectedJobs()}
                  disabled={
                    !canRefreshImports ||
                    refreshingJobs ||
                    deletingJobs ||
                    selectedJobIds.size === 0
                  }
                  className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {refreshingJobs ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                  Refresh Selected
                </button>

                <button
                  type="button"
                  onClick={() => void deleteSelectedJobs()}
                  disabled={
                    !canDeleteImports ||
                    deletingJobs ||
                    refreshingJobs ||
                    selectedJobIds.size === 0
                  }
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingJobs ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete Selected
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {recentJobsLoading ? (
                <div className="flex items-center gap-2 text-sm text-neutral-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading recent jobs...
                </div>
              ) : recentJobs.length === 0 ? (
                <p className="text-sm text-neutral-500">No recent jobs found.</p>
              ) : (
                recentJobs.map((job) => {
                  const selected = selectedJobIds.has(job.id);
                  const stuck = isJobStuck(job);
                  const jobProgress = getJobProgressValue(job);

                  return (
                    <div
                      key={job.id}
                      className={`rounded-2xl border p-4 transition ${
                        selected
                          ? "border-blue-400/40 bg-blue-500/10"
                          : stuck
                            ? "border-purple-400/30 bg-purple-500/10"
                            : "border-white/10 bg-black/30"
                      }`}
                    >
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <label className="flex min-w-0 items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={deletingJobs || refreshingJobs}
                            onChange={() => toggleJobSelection(job.id)}
                            className="mt-1 h-4 w-4 rounded border-white/20 bg-black"
                            aria-label={`Select ${
                              job.originalFileName || job.reportType || "import job"
                            }`}
                          />

                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {job.reportLabel || job.reportType || "Unknown report"}
                            </span>

                            <span className="mt-1 block truncate text-sm text-neutral-400">
                              {job.originalFileName || "Unnamed file"}
                            </span>

                            <span className="mt-1 block text-xs text-neutral-500">
                              Uploaded by {job.uploadedByEmail || "unknown"} ·{" "}
                              {formatTimestamp(job.createdAt)}
                            </span>

                            {job.weeklyBatchKey ? (
                              <span className="mt-1 block text-xs text-neutral-500">
                                Batch: {job.weeklyBatchKey}
                              </span>
                            ) : null}

                            {job.storagePath ? (
                              <span className="mt-1 block truncate text-xs text-neutral-600">
                                Storage: {job.storagePath}
                              </span>
                            ) : null}
                          </span>
                        </label>

                        <div className="flex flex-wrap items-center gap-2">
                          {stuck ? (
                            <span className="rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-1 text-xs text-purple-200">
                              stuck
                            </span>
                          ) : null}

                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-300">
                            {job.processingStatus || job.status || "unknown"}
                          </span>

                          {job.importMode === "overwrite_report_type" ? (
                            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                              overwrite
                            </span>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => void refreshImportJob(job)}
                            disabled={
                              !canRefreshImports || deletingJobs || refreshingJobs
                            }
                            className="inline-flex items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 p-2 text-blue-200 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Refresh ${
                              job.originalFileName || job.reportType || "import job"
                            }`}
                          >
                            <RefreshCcw className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => void deleteImportJob(job)}
                            disabled={
                              !canDeleteImports || deletingJobs || refreshingJobs
                            }
                            className="inline-flex items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 p-2 text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Delete ${
                              job.originalFileName || job.reportType || "import job"
                            }`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                          <span>
                            {job.processingStage ||
                              job.processingStatus ||
                              "waiting"}
                          </span>
                          <span>{jobProgress}%</span>
                        </div>

                        <progress
                          value={jobProgress}
                          max={100}
                          className={`${getJobProgressClass(job)} mt-2`}
                        />

                        {(job.rowsProcessed ||
                          job.rowsInserted ||
                          job.rowsFailed) > 0 ? (
                          <div className="mt-3 grid gap-2 text-xs text-neutral-400 sm:grid-cols-3">
                            <MiniStat
                              label="Rows Processed"
                              value={job.rowsProcessed}
                            />
                            <MiniStat
                              label="Rows Inserted"
                              value={job.rowsInserted}
                            />
                            <MiniStat label="Rows Failed" value={job.rowsFailed} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
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
  tone?: "neutral" | "blue" | "amber" | "rose" | "emerald";
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-400/20 bg-blue-500/10 text-blue-200"
      : tone === "amber"
        ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
        : tone === "rose"
          ? "border-rose-400/20 bg-rose-500/10 text-rose-200"
          : tone === "emerald"
            ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
            : "border-white/10 bg-white/5 text-neutral-200";

  return (
    <div className={`rounded-3xl border p-5 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm opacity-80">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-xs opacity-70">{helper}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
      <span className="text-sm text-neutral-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

function StatusBadge({ step }: { step: UploadStep }) {
  const label = getStepLabel(step);

  const className =
    step === "complete"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      : step === "failed"
        ? "border-red-400/20 bg-red-500/10 text-red-200"
        : isActiveStep(step)
          ? "border-blue-400/20 bg-blue-500/10 text-blue-200"
          : "border-white/10 bg-white/5 text-neutral-300";

  const icon =
    step === "complete" ? (
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
    ) : step === "failed" ? (
      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
    ) : isActiveStep(step) ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
    ) : (
      <Database className="h-3.5 w-3.5" aria-hidden="true" />
    );

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}