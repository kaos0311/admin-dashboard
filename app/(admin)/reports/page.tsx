"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTaskSnapshot,
} from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCcw,
  Search,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";

import { auth, db, functions, storage } from "@/lib/firebase";
import { REPORT_TYPES, type ReportType } from "@/lib/reportTypes";
import styles from "./ReportsPage.module.css";

type ImportedReport = {
  id: string;
  fileName?: string;
  originalFileName?: string;
  reportType?: string;
  selectedReportType?: string;
  detectedReportType?: string;
  reportTypes?: string[];
  selectedReportTypes?: string[];
  detectedReportTypes?: string[];
  primaryReportType?: string;
  fileType?: string;
  fileSize?: number;
  storagePath?: string;
  storageBucket?: string;
  downloadURL?: string;
  uploadedToCloud?: boolean;
  cloudVerified?: boolean;
  totalRows?: number;
  rowCount?: number;
  processedRows?: number;
  uploadedByEmail?: string | null;
  createdAt?: Timestamp | null;
  uploadedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  status?: string;
  error?: string;
};

type ImportJob = {
  id: string;
  fileName?: string;
  originalFileName?: string;
  safeFileName?: string;
  reportType?: string;
  selectedReportType?: string;
  detectedReportType?: string;
  reportTypes?: string[];
  selectedReportTypes?: string[];
  detectedReportTypes?: string[];
  primaryReportType?: string;
  fileType?: string;
  mimeType?: string;
  fileSize?: number;
  storagePath?: string;
  storageBucket?: string;
  downloadURL?: string;
  uploadedToCloud?: boolean;
  cloudVerified?: boolean;
  cloudUploadVerified?: boolean;
  uploadedByEmail?: string | null;
  processedRows?: number;
  totalRows?: number;
  status?: string;
  processingStatus?: string;
  error?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  uploadedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  reprocessRequestedAt?: Timestamp | null;
};

type SoftResetResult = {
  ok?: boolean;
  deletedCollections?: string[];
};

type ReprocessResult = {
  ok?: boolean;
  jobId?: string;
  storagePath?: string;
};

const ACCEPTED_FILE_TYPES = ".csv,.pdf,text/csv,application/pdf";

function formatDate(value?: Timestamp | null): string {
  if (!value) return "—";

  try {
    return value.toDate().toLocaleString();
  } catch {
    return "—";
  }
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

function cleanFileName(name: string): string {
  return name
    .trim()
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 140);
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

function statusLabel(status?: string): string {
  if (!status) return "unknown";
  return status.replace(/_/g, " ");
}

function reportTypeLabel(value?: string): string {
  const found = REPORT_TYPES.find((type) => type.value === value);
  return found?.label ?? value ?? "—";
}

function reportTypesLabel(values?: string[]): string {
  if (!values?.length) return "—";
  return values.map(reportTypeLabel).join(", ");
}

function normalizeReportTypeList(params: {
  reportTypes?: string[];
  selectedReportTypes?: string[];
  detectedReportTypes?: string[];
  primaryReportType?: string;
  reportType?: string;
  selectedReportType?: string;
  detectedReportType?: string;
}): string[] {
  const values = [
    ...(params.detectedReportTypes ?? []),
    ...(params.selectedReportTypes ?? []),
    ...(params.reportTypes ?? []),
    params.primaryReportType,
    params.detectedReportType,
    params.selectedReportType,
    params.reportType,
  ].filter(Boolean) as string[];

  return Array.from(new Set(values));
}

function isBusyStatus(status?: string): boolean {
  return status === "processing";
}

function inferReportTypesFromFileName(fileName: string): ReportType[] {
  const name = fileName.toLowerCase();
  const found = new Set<ReportType>();

  function add(type: ReportType) {
    found.add(type);
  }

  if (name.includes("patient")) add("patients" as ReportType);
  if (name.includes("insurance")) add("insurance" as ReportType);
  if (name.includes("work") || name.includes("wip")) add("wip" as ReportType);
  if (name.includes("hospice")) add("hospice" as ReportType);

  if (name.includes("delivery") || name.includes("ticket")) {
    add("delivery" as ReportType);
    add("purchases" as ReportType);
    add("items" as ReportType);
    add("inventory" as ReportType);
  }

  if (name.includes("item detail")) add("items" as ReportType);

  if (name.includes("item status") || name.includes("inventory")) {
    add("inventory" as ReportType);
    add("items" as ReportType);
  }

  if (name.includes("par")) add("par" as ReportType);
  if (name.includes("cmn")) add("cmn" as ReportType);

  if (name.includes("ar activity") || name.includes("billing")) {
    add("ar" as ReportType);
  }

  if (name.includes("purchase") || name.includes("sales")) {
    add("purchases" as ReportType);
  }

  return Array.from(found);
}

function buildReportRouting(types: ReportType[]) {
  const selected = Array.from(new Set(types));

  const has = (type: string) => selected.includes(type as ReportType);

  const routeTargets = selected.map((type) => ({
    reportType: type,
    storageFolder: `reports/uploads/${type}/`,
    indexCollection:
      type === "patients"
        ? "patients"
        : type === "hospice"
          ? "hospicePatients"
          : type === "insurance"
            ? "insurancePatients"
            : type === "wip"
              ? "wip"
              : type === "delivery"
                ? "deliveryTickets"
                : type === "inventory"
                  ? "inventory"
                  : type === "items"
                    ? "items"
                    : type === "purchases"
                      ? "purchases"
                      : type === "par"
                        ? "parRecords"
                        : type === "cmn"
                          ? "cmnRecords"
                          : type === "ar"
                            ? "arRecords"
                            : "importedReports",
  }));

  return {
    routes: {
      patients: has("patients"),
      hospice: has("hospice"),
      insurance: has("insurance"),
      wip: has("wip"),
      delivery: has("delivery"),
      purchases: has("purchases"),
      items: has("items"),
      inventory: has("inventory"),
      par: has("par"),
      cmn: has("cmn"),
      ar: has("ar"),
    },

    routeTargets,

    shouldBuildPatientIndex:
      has("patients") ||
      has("hospice") ||
      has("insurance") ||
      has("wip") ||
      has("delivery"),

    shouldBuildInventoryIndex:
      has("delivery") || has("items") || has("inventory") || has("purchases"),

    shouldBuildFinancialIndex:
      has("insurance") || has("ar") || has("purchases"),

    shouldBuildHospiceIndex: has("hospice") || has("insurance"),
  };
}

export default function ReportsPage() {
  const [selectedTypes, setSelectedTypes] = useState<ReportType[]>([
    "patients" as ReportType,
  ]);
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [message, setMessage] = useState("");
  const [reports, setReports] = useState<ImportedReport[]>([]);
  const [jobs, setJobs] = useState<ImportJob[]>([]);

  const [jobSearch, setJobSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");

  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [softResetting, setSoftResetting] = useState(false);
  const [softResetConfirm, setSoftResetConfirm] = useState("");

  const uploadLockRef = useRef(false);

  useEffect(() => {
    const reportsQuery = query(
      collection(db, "importedReports"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      reportsQuery,
      (snapshot) => {
        const nextReports: ImportedReport[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Omit<ImportedReport, "id">;
          return { id: docSnap.id, ...data };
        });

        setReports(nextReports);
      },
      (error) => {
        console.error("REPORTS SNAPSHOT ERROR:", error);
        setMessage("Could not load imported reports. Check Firestore permissions.");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const jobsQuery = query(
      collection(db, "importJobs"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      jobsQuery,
      (snapshot) => {
        const nextJobs: ImportJob[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Omit<ImportJob, "id">;
          return { id: docSnap.id, ...data };
        });

        setJobs(nextJobs);
      },
      (error) => {
        console.error("IMPORT JOBS SNAPSHOT ERROR:", error);
        setMessage("Could not load import jobs. Check Firestore permissions.");
      }
    );

    return () => unsubscribe();
  }, []);

  const selectedFileType = useMemo(() => {
    return selectedFile ? getFileExtension(selectedFile.name) : null;
  }, [selectedFile]);

  const primaryReportType = selectedTypes[0] ?? ("unknown" as ReportType);

  const canImport = useMemo(() => {
    return (
      Boolean(selectedFile && selectedFileType) &&
      selectedTypes.length > 0 &&
      !uploading &&
      !softResetting
    );
  }, [selectedFile, selectedFileType, selectedTypes.length, uploading, softResetting]);

  const canSoftReset = useMemo(() => {
    return softResetConfirm === "RESET REPORTS" && !softResetting && !uploading;
  }, [softResetConfirm, softResetting, uploading]);

  const routingPreview = useMemo(() => {
    return buildReportRouting(selectedTypes);
  }, [selectedTypes]);

  const filteredJobs = useMemo(() => {
    const needle = jobSearch.trim().toLowerCase();
    if (!needle) return jobs;

    return jobs.filter((job) =>
      [
        job.fileName,
        job.originalFileName,
        job.reportType,
        job.selectedReportType,
        job.detectedReportType,
        job.reportTypes?.join(" "),
        job.selectedReportTypes?.join(" "),
        job.detectedReportTypes?.join(" "),
        job.status,
        job.processingStatus,
        job.storagePath,
        job.uploadedByEmail,
        job.error,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [jobs, jobSearch]);

  const filteredReports = useMemo(() => {
    const needle = reportSearch.trim().toLowerCase();
    if (!needle) return reports;

    return reports.filter((report) =>
      [
        report.fileName,
        report.originalFileName,
        report.reportType,
        report.selectedReportType,
        report.detectedReportType,
        report.reportTypes?.join(" "),
        report.selectedReportTypes?.join(" "),
        report.detectedReportTypes?.join(" "),
        report.status,
        report.storagePath,
        report.uploadedByEmail,
        report.error,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [reports, reportSearch]);

  function resetSelectedFile() {
    setSelectedFile(null);
    setUploadProgress(0);
    setMessage("");

    const fileInput = document.getElementById(
      "report-upload-input"
    ) as HTMLInputElement | null;

    if (fileInput) fileInput.value = "";
  }

  function toggleReportType(type: ReportType) {
    setSelectedTypes((current) => {
      if (current.includes(type)) {
        return current.filter((item) => item !== type);
      }

      return [...current, type];
    });
  }

  function handleFileChange(file: File | null) {
    setSelectedFile(file);
    setUploadProgress(0);
    setMessage("");

    if (!file || !autoDetectEnabled) return;

    const detected = inferReportTypesFromFileName(file.name);

    if (detected.length) {
      setSelectedTypes(detected);
      setMessage(
        `Auto-detected report type${detected.length === 1 ? "" : "s"}: ${reportTypesLabel(
          detected
        )}. Review before uploading.`
      );
    }
  }

  function selectAllReportTypes() {
    setSelectedTypes(REPORT_TYPES.map((type) => type.value as ReportType));
  }

  function clearReportTypes() {
    setSelectedTypes([]);
  }

  async function handleImport(): Promise<void> {
    if (uploadLockRef.current || uploading) return;

    if (!selectedFile) {
      setMessage("Please choose a CSV or PDF file first.");
      return;
    }

    if (!selectedTypes.length) {
      setMessage("Select at least one report type before uploading.");
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      setMessage("You must be logged in to import reports.");
      return;
    }

    const fileType = getFileExtension(selectedFile.name);

    if (!fileType) {
      setMessage("Only CSV and PDF files are supported.");
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
      const storagePath = `reports/uploads/${primaryReportType}/${jobId}-${safeFileName}`;
      const storageRef = ref(storage, storagePath);
      const routing = buildReportRouting(selectedTypes);
      const destinationCollections = routing.routeTargets.map(
        (target) => target.indexCollection
      );

      await setDoc(jobRef, {
        id: jobId,

        fileName: selectedFile.name,
        originalFileName: selectedFile.name,
        safeFileName,
        fileType,
        mimeType,
        fileSize: selectedFile.size,

        primaryReportType,
        selectedReportTypes: selectedTypes,
        reportTypes: selectedTypes,

        selectedReportType: primaryReportType,
        reportType: primaryReportType,
        reportLabel: reportTypesLabel(selectedTypes),

        routing,
        routingVersion: 1,

        processingPlan: {
          source: "reports-page",
          fileKind: fileType,
          primaryReportType,
          selectedReportTypes: selectedTypes,

          buildImportedRows: true,
          buildPatientProfiles: routing.shouldBuildPatientIndex,
          buildInventoryRecords: routing.shouldBuildInventoryIndex,
          buildFinancialRecords: routing.shouldBuildFinancialIndex,
          buildHospiceRecords: routing.shouldBuildHospiceIndex,

          targetCollections: destinationCollections,
        },

        destinationCollections,

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

      setMessage("Import job created. Uploading file to Firebase Storage...");

      const uploadTask = uploadBytesResumable(storageRef, selectedFile, {
        contentType: mimeType,
        customMetadata: {
          jobId,
          primaryReportType,
          reportType: primaryReportType,
          reportTypes: selectedTypes.join(","),
          destinationCollections: destinationCollections.join(","),
          routingVersion: "1",
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

      setMessage(
        "Upload complete. File is verified in Firebase Storage and queued for smart routing."
      );

      resetSelectedFile();
    } catch (error) {
      console.error("REPORT UPLOAD ERROR:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to upload report. Check Firebase Storage rules and permissions."
      );
    } finally {
      uploadLockRef.current = false;
      setUploading(false);
    }
  }

  async function handleReprocessJob(job: ImportJob): Promise<void> {
    if (!job.id || !job.storagePath) {
      setMessage("This job cannot be reprocessed because it has no storage path.");
      return;
    }

    const confirmed = window.confirm(
      `Reprocess "${
        job.fileName ?? job.originalFileName ?? job.id
      }"?\n\nThis reuses the existing Firebase Storage file and reruns parsing/indexing.`
    );

    if (!confirmed) return;

    try {
      setReprocessingId(job.id);
      setMessage("");

      const callable = httpsCallable<{ jobId: string }, ReprocessResult>(
        functions,
        "reprocessImportJob"
      );

      await callable({ jobId: job.id });

      setMessage(
        `Reprocess started for "${job.fileName ?? job.originalFileName ?? job.id}".`
      );
    } catch (error) {
      console.error("REPROCESS IMPORT JOB ERROR:", error);

      setMessage(
        error instanceof Error ? error.message : "Failed to reprocess import job."
      );
    } finally {
      setReprocessingId(null);
    }
  }

  async function handleDeleteStorageFile(report: ImportedReport): Promise<void> {
    if (!report.storagePath) {
      setMessage("This report has no Storage file path saved.");
      return;
    }

    const confirmed = window.confirm(
      `Delete Storage file for "${
        report.fileName ?? report.originalFileName ?? report.id
      }"?\n\nThis only deletes the uploaded file, not the Firestore report rows.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(report.id);
      setMessage("");

      await deleteObject(ref(storage, report.storagePath));

      setMessage(
        `Deleted Storage file for "${
          report.fileName ?? report.originalFileName ?? report.id
        }".`
      );
    } catch (error) {
      console.error("DELETE STORAGE FILE ERROR:", error);

      setMessage(
        error instanceof Error ? error.message : "Failed to delete Storage file."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSoftResetReports(): Promise<void> {
    if (softResetConfirm !== "RESET REPORTS") {
      setMessage("Type RESET REPORTS before soft resetting.");
      return;
    }

    const confirmed = window.confirm(
      "This clears report records, report rows, import jobs, analytics, and patient indexes. It does not delete users, settings, products, orders, rentals, or uploaded Storage files. Continue?"
    );

    if (!confirmed) return;

    try {
      setSoftResetting(true);
      setMessage("");

      const callable = httpsCallable<{ confirmText: string }, SoftResetResult>(
        functions,
        "softResetReports"
      );

      const result = await callable({
        confirmText: "RESET REPORTS",
      });

      const cleared = result.data.deletedCollections ?? [];

      setMessage(
        cleared.length
          ? `Reports soft reset complete. Cleared: ${cleared.join(", ")}.`
          : "Reports soft reset complete."
      );

      setSoftResetConfirm("");
    } catch (error) {
      console.error("REPORTS SOFT RESET ERROR:", error);

      setMessage(
        error instanceof Error ? error.message : "Reports soft reset failed."
      );
    } finally {
      setSoftResetting(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#101827] to-black p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-zinc-300">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                Firebase Storage import pipeline
              </div>

              <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>

              <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                Upload CSV or PDF reports directly to Firebase Cloud Storage.
                Select one or more report roles so Cloud Functions can route the
                same file into patients, insurance, WIP, delivery, inventory,
                billing, PAR, CMN, hospice, and analytics.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Smart routing enabled
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4 text-sm text-zinc-200">
            {message}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(620px,1fr)_340px]">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-cyan-300">
                <UploadCloud className="h-5 w-5" aria-hidden="true" />
              </div>

              <div>
                <h2 className="text-xl font-semibold">Upload report</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Every upload creates an import job, uploads the raw file to
                  Storage, and writes a routing manifest for Cloud Functions.
                  Back in my day, we called that “telling the damn machine what
                  to do.”
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <fieldset disabled={uploading}>
                <legend className="mb-3 block text-base font-semibold text-zinc-200">
                  Report roles
                </legend>

                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllReportTypes}
                    disabled={uploading}
                    className="rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
                  >
                    Select all
                  </button>

                  <button
                    type="button"
                    onClick={clearReportTypes}
                    disabled={uploading}
                    className="rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
                  >
                    Clear
                  </button>

                  <label className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={autoDetectEnabled}
                      onChange={(event) =>
                        setAutoDetectEnabled(event.target.checked)
                      }
                      className="h-4 w-4 accent-cyan-300"
                    />
                    Auto-detect from filename
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {REPORT_TYPES.map((type) => {
                    const checked = selectedTypes.includes(
                      type.value as ReportType
                    );

                    return (
                      <label
                        key={type.value}
                        className={[
                          "flex min-h-[78px] cursor-pointer items-center gap-4 rounded-3xl border px-5 py-4 text-base font-medium transition-all",
                          checked
                            ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-50 shadow-lg shadow-cyan-500/10"
                            : "border-zinc-800 bg-black/40 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            toggleReportType(type.value as ReportType)
                          }
                          className="h-5 w-5 accent-cyan-300"
                        />

                        <span>{type.label}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                  <p className="text-sm font-semibold text-cyan-100">
                    Routing preview
                  </p>

                  <div className="mt-3 grid gap-2 text-xs text-cyan-100/80 sm:grid-cols-2">
                    <InfoLine
                      label="Targets"
                      value={
                        routingPreview.routeTargets.length
                          ? routingPreview.routeTargets
                              .map((target) => target.indexCollection)
                              .join(", ")
                          : "none"
                      }
                    />
                    <InfoLine
                      label="Patient index"
                      value={
                        routingPreview.shouldBuildPatientIndex ? "yes" : "no"
                      }
                    />
                    <InfoLine
                      label="Inventory index"
                      value={
                        routingPreview.shouldBuildInventoryIndex ? "yes" : "no"
                      }
                    />
                    <InfoLine
                      label="Financial index"
                      value={
                        routingPreview.shouldBuildFinancialIndex ? "yes" : "no"
                      }
                    />
                    <InfoLine
                      label="Hospice index"
                      value={
                        routingPreview.shouldBuildHospiceIndex ? "yes" : "no"
                      }
                    />
                  </div>
                </div>

                <p className="mt-4 text-sm text-zinc-500">
                  Selected:{" "}
                  <span className="text-zinc-300">
                    {selectedTypes.length
                      ? reportTypesLabel(selectedTypes)
                      : "none"}
                  </span>
                </p>
              </fieldset>

              <div>
                <label
                  htmlFor="report-upload-input"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Upload CSV or PDF file
                </label>

                <input
                  id="report-upload-input"
                  name="reportFile"
                  title="Upload CSV or PDF report file"
                  aria-label="Upload CSV or PDF report file"
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  disabled={uploading}
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    handleFileChange(nextFile);
                  }}
                  className="block w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-black disabled:opacity-60"
                />
              </div>

              {selectedFile ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
                  <InfoLine label="File" value={selectedFile.name} />
                  <InfoLine label="Size" value={formatBytes(selectedFile.size)} />
                  <InfoLine
                    label="Type"
                    value={selectedFileType?.toUpperCase() || "Unsupported"}
                  />
                  <InfoLine
                    label="Primary role"
                    value={reportTypeLabel(primaryReportType)}
                  />
                  <InfoLine
                    label="All roles"
                    value={reportTypesLabel(selectedTypes)}
                  />
                  <InfoLine
                    label="Cloud target"
                    value={`reports/uploads/${primaryReportType}/`}
                  />

                  {!selectedFileType ? (
                    <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-200">
                      Unsupported file type. Use CSV or PDF.
                    </div>
                  ) : null}

                  {!selectedTypes.length ? (
                    <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-200">
                      Select at least one report role.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {uploading || uploadProgress > 0 ? (
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm text-cyan-100">
                    <span>Uploading to Firebase Storage</span>
                    <span>{uploadProgress}%</span>
                  </div>

                  <progress
                    value={uploadProgress}
                    max={100}
                    aria-label="Report upload progress"
                    className={`${styles.progressTrack} ${styles.progressProcessing}`}
                  />
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={!canImport}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" />
                      Upload to Cloud
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

          <section className="self-start rounded-2xl border border-amber-500/10 bg-amber-500/5 p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-amber-500/20 bg-black/30 p-2 text-amber-200">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              </div>

              <div className="flex-1">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-200">
                  Reports Soft Reset
                </h2>

                <p className="mt-1 text-xs leading-5 text-amber-100/60">
                  Clears report records, rows, import jobs, analytics, patient
                  indexes, hospice indexes, and insurance indexes. Uploaded
                  Storage files are not deleted.
                </p>

                <label htmlFor="soft-reset-confirm" className="mt-4 block">
                  <span className="text-xs font-medium text-amber-100">
                    Type RESET REPORTS to confirm
                  </span>

                  <input
                    id="soft-reset-confirm"
                    name="softResetConfirm"
                    title="Type RESET REPORTS to confirm"
                    aria-label="Type RESET REPORTS to confirm"
                    value={softResetConfirm}
                    onChange={(event) =>
                      setSoftResetConfirm(event.target.value)
                    }
                    disabled={softResetting || uploading}
                    placeholder="RESET REPORTS"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-amber-400/40"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void handleSoftResetReports()}
                  disabled={!canSoftReset}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {softResetting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Soft Reset
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
          <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Import Jobs</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Upload → Route → Process → Index → Complete
              </p>
            </div>

            <SearchBox
              id="job-search"
              value={jobSearch}
              onChange={setJobSearch}
              placeholder="Search jobs..."
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-800">
            <div className="min-w-[1180px]">
              <div className="grid grid-cols-[1.6fr_1.3fr_1.1fr_1fr_1.2fr_1fr_160px] gap-4 border-b border-zinc-800 bg-zinc-900 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <div>File</div>
                <div>Roles</div>
                <div>Status</div>
                <div>Cloud</div>
                <div>Progress</div>
                <div>Uploaded</div>
                <div>Actions</div>
              </div>

              <div className="divide-y divide-zinc-800">
                {filteredJobs.length === 0 ? (
                  <div className="px-4 py-8 text-sm text-zinc-500">
                    No import jobs found.
                  </div>
                ) : (
                  filteredJobs.map((job) => {
                    const processed = job.processedRows ?? 0;
                    const total = job.totalRows ?? 0;
                    const percent =
                      total > 0
                        ? Math.min(100, Math.round((processed / total) * 100))
                        : 0;

                    const failed = job.status === "failed" || job.status === "error";
                    const processing = isBusyStatus(job.status);
                    const canReprocess =
                      Boolean(job.storagePath) &&
                      !processing &&
                      !softResetting &&
                      reprocessingId !== job.id;

                    const jobTypes = normalizeReportTypeList(job);

                    return (
                      <div
                        key={job.id}
                        className={[
                          "grid grid-cols-[1.6fr_1.3fr_1.1fr_1fr_1.2fr_1fr_160px] gap-4 px-4 py-4 text-sm",
                          failed ? "bg-red-950/20" : "",
                        ].join(" ")}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-white">
                            {job.fileName || job.originalFileName || job.id}
                          </div>

                          <div className="truncate text-xs text-zinc-500">
                            {job.storagePath || "No storage path"}
                          </div>

                          <div className="mt-1 text-xs text-zinc-600">
                            {formatBytes(job.fileSize)}
                          </div>

                          {job.error ? (
                            <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-300">
                              {job.error}
                            </div>
                          ) : null}
                        </div>

                        <div className="text-zinc-300">
                          <div>{reportTypesLabel(jobTypes)}</div>

                          {job.primaryReportType ? (
                            <div className="mt-1 text-xs text-zinc-500">
                              primary: {reportTypeLabel(job.primaryReportType)}
                            </div>
                          ) : null}
                        </div>

                        <div>
                          <StatusPill status={job.status} />

                          {job.processingStatus ? (
                            <div className="mt-1 text-xs text-zinc-500">
                              {statusLabel(job.processingStatus)}
                            </div>
                          ) : null}
                        </div>

                        <CloudBadge
                          uploadedToCloud={job.uploadedToCloud}
                          cloudVerified={job.cloudVerified}
                          downloadURL={job.downloadURL}
                        />

                        <div>
                          <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                            <span>
                              {processed.toLocaleString()}
                              {total ? ` / ${total.toLocaleString()}` : ""}
                            </span>
                            <span>{percent}%</span>
                          </div>

                          <progress
                            value={percent}
                            max={100}
                            aria-label={`Import progress for ${
                              job.fileName || job.originalFileName || job.id
                            }`}
                            className={[
                              styles.progressTrack,
                              failed
                                ? styles.progressFailed
                                : processing
                                  ? styles.progressProcessing
                                  : job.status === "completed"
                                    ? styles.progressCompleted
                                    : styles.progressWaiting,
                            ].join(" ")}
                          />
                        </div>

                        <div className="text-zinc-400">
                          {formatDate(job.uploadedAt ?? job.createdAt)}
                        </div>

                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => void handleReprocessJob(job)}
                            disabled={!canReprocess}
                            className={[
                              "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-50",
                              failed
                                ? "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                                : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20",
                            ].join(" ")}
                          >
                            <RefreshCcw
                              className={[
                                "h-3.5 w-3.5",
                                reprocessingId === job.id ? "animate-spin" : "",
                              ].join(" ")}
                            />
                            {reprocessingId === job.id
                              ? "Starting..."
                              : failed
                                ? "Retry"
                                : "Reprocess"}
                          </button>

                          {job.downloadURL ? (
                            <a
                              href={job.downloadURL}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              File
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
          <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Imported Reports</h2>
              <p className="mt-1 text-sm text-zinc-500">
                These appear after Cloud Functions finish processing uploaded files.
              </p>
            </div>

            <SearchBox
              id="report-search"
              value={reportSearch}
              onChange={setReportSearch}
              placeholder="Search processed reports..."
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-800">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[1.7fr_1.3fr_120px_1fr_1.2fr_180px] gap-4 border-b border-zinc-800 bg-zinc-900 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <div>File</div>
                <div>Roles</div>
                <div>Rows</div>
                <div>Cloud</div>
                <div>Completed</div>
                <div>Actions</div>
              </div>

              <div className="divide-y divide-zinc-800">
                {filteredReports.length === 0 ? (
                  <div className="px-4 py-8 text-sm text-zinc-500">
                    No processed reports found.
                  </div>
                ) : (
                  filteredReports.map((report) => {
                    const reportTypes = normalizeReportTypeList(report);

                    return (
                      <div
                        key={report.id}
                        className="grid grid-cols-[1.7fr_1.3fr_120px_1fr_1.2fr_180px] gap-4 px-4 py-4 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-white">
                            {report.fileName ?? report.originalFileName ?? report.id}
                          </div>
                          <div className="truncate text-xs text-zinc-500">
                            {report.storagePath || report.id}
                          </div>
                          {report.error ? (
                            <div className="mt-1 truncate text-xs text-red-300">
                              {report.error}
                            </div>
                          ) : null}
                        </div>

                        <div className="text-zinc-300">
                          {reportTypesLabel(reportTypes)}
                        </div>

                        <div className="text-zinc-300">
                          {(
                            report.totalRows ??
                            report.rowCount ??
                            report.processedRows ??
                            0
                          ).toLocaleString()}
                        </div>

                        <CloudBadge
                          uploadedToCloud={report.uploadedToCloud}
                          cloudVerified={report.cloudVerified}
                          downloadURL={report.downloadURL}
                        />

                        <div className="text-zinc-400">
                          {formatDate(report.completedAt ?? report.createdAt)}
                        </div>

                        <div className="flex items-center gap-2">
                          {report.downloadURL ? (
                            <a
                              href={report.downloadURL}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              File
                            </a>
                          ) : null}

                          {report.storagePath ? (
                            <button
                              type="button"
                              onClick={() => void handleDeleteStorageFile(report)}
                              disabled={deletingId === report.id || softResetting}
                              className="inline-flex items-center gap-2 rounded-xl border border-red-800 px-3 py-2 text-xs text-red-300 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {deletingId === report.id ? "Deleting..." : "Delete"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SearchBox({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full xl:w-80">
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>

      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

      <input
        id={id}
        name={id}
        title={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
      />
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 break-words first:mt-0">
      <span className="text-zinc-500">{label}:</span> {value}
    </div>
  );
}

function StatusPill({ status }: { status?: string }) {
  const normalized = status || "unknown";

  const className =
    normalized === "completed"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : normalized === "failed" || normalized === "error"
        ? "border-red-500/20 bg-red-500/10 text-red-300"
        : normalized === "processing" || normalized === "uploaded"
          ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
          : "border-amber-500/20 bg-amber-500/10 text-amber-300";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs capitalize ${className}`}
    >
      {statusLabel(normalized)}
    </span>
  );
}

function CloudBadge({
  uploadedToCloud,
  cloudVerified,
  downloadURL,
}: {
  uploadedToCloud?: boolean;
  cloudVerified?: boolean;
  downloadURL?: string;
}) {
  const verified = uploadedToCloud === true && cloudVerified === true;

  if (verified) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Cloud verified
        </span>

        {downloadURL ? (
          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
            <Cloud className="h-3.5 w-3.5" />
            URL ready
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-300">
      <XCircle className="h-3.5 w-3.5" />
      Not verified
    </span>
  );
}