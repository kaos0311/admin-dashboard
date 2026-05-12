"use client";

import { useEffect, useMemo, useState } from "react";

import {
  FileSpreadsheet,
  FileText,
  HeartPulse,
  Loader2,
  Upload,
} from "lucide-react";

import toast from "react-hot-toast";

import { REPORT_TYPES, type ReportType } from "@/lib/reportTypes";

import {
  uploadFileForServerImport,
  watchImportJob,
  type ImportJobSnapshot,
} from "@/lib/serverImport";

import { useAppSettings } from "@/app/hooks/useAppSettings";

const fileSizeFormatter = new Intl.NumberFormat("en-US");

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ServerImportUploader() {
  const { settings } = useAppSettings(true);

  const [file, setFile] = useState<File | null>(null);

  const [reportType, setReportType] =
    useState<ReportType>("custom");

  const [overrideSkip, setOverrideSkip] =
    useState<boolean | null>(null);

  const [jobId, setJobId] = useState("");
  const [job, setJob] =
    useState<ImportJobSnapshot | null>(null);

  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const skipHospicePatients =
    overrideSkip !== null
      ? overrideSkip
      : settings.skipHospicePatientsOnRegularPages;

  useEffect(() => {
    if (!jobId) return;

    return watchImportJob(jobId, setJob);
  }, [jobId]);

  const processed = Number(job?.processedRows || 0);
  const total = Number(job?.totalRows || 0);

  const skippedHospiceRows = Number(
    job?.skippedHospiceRows ||
      job?.hospiceRows ||
      0
  );

  const percent =
    total > 0
      ? Math.min(
          100,
          Math.round((processed / total) * 100)
        )
      : 0;

  const fileType = useMemo(() => {
    if (!file) return null;

    const lower = file.name.toLowerCase();

    if (lower.endsWith(".pdf")) return "pdf";
    if (lower.endsWith(".csv")) return "csv";

    return "unknown";
  }, [file]);

  function validateFile(selectedFile: File): boolean {
    const lowerName = selectedFile.name.toLowerCase();

    const isCsv = lowerName.endsWith(".csv");
    const isPdf = lowerName.endsWith(".pdf");

    if (!isCsv && !isPdf) {
      toast.error(
        "Only CSV and PDF files are supported."
      );

      return false;
    }

    const maxSizeMb = 50;

    if (
      selectedFile.size >
      maxSizeMb * 1024 * 1024
    ) {
      toast.error(
        `File exceeds ${maxSizeMb}MB upload limit.`
      );

      return false;
    }

    return true;
  }

  function handleFileSelection(
    selectedFile: File | null
  ) {
    if (!selectedFile) return;

    if (!validateFile(selectedFile)) {
      return;
    }

    setFile(selectedFile);
  }

  async function handleUpload() {
    if (!file) {
      toast.error(
        "Choose a CSV or PDF file first."
      );

      return;
    }

    try {
      setUploading(true);
      setJob(null);

      const result =
        await uploadFileForServerImport({
          file,
          reportType,
          skipHospicePatients,
        });

      setJobId(result.jobId);

      toast.success(
        `${
          fileType === "pdf" ? "PDF" : "CSV"
        } uploaded. Server import started.`
      );

      setFile(null);
    } catch (error) {
      console.error(
        "SERVER IMPORT UPLOAD ERROR:",
        error
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "Upload failed."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <section
      role="region"
      aria-label="Server report import"
      className="rounded-3xl border border-white/10 bg-neutral-950 p-6 text-white"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            Server Report Import
          </h2>

          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Upload CSV or text-based PDF files.
            Raw files are stored in Firebase
            Storage while parsed rows are
            indexed into Firestore analytics.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Import Mode
          </div>

          <div className="mt-1 text-sm font-medium text-white">
            Server Processing
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <label
            htmlFor="server-report-type"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            Report Type
          </label>

          <select
            id="server-report-type"
            title="Report Type"
            aria-label="Report Type"
            value={reportType}
            disabled={uploading}
            onChange={(event) =>
              setReportType(
                event.target.value as ReportType
              )
            }
            className="select-dark"
          >
            {REPORT_TYPES.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-2 block text-sm font-medium text-zinc-300">
            Upload File
          </div>

          <label
            htmlFor="server-import-file"
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => {
              setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();

              setDragging(false);

              const droppedFile =
                event.dataTransfer.files?.[0];

              handleFileSelection(
                droppedFile ?? null
              );
            }}
            className={`flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed p-6 text-center transition ${
              dragging
                ? "border-cyan-400 bg-cyan-500/10"
                : "border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/[0.03]"
            }`}
          >
            <input
              id="server-import-file"
              type="file"
              accept=".csv,.pdf,text/csv,application/pdf"
              disabled={uploading}
              onChange={(event) =>
                handleFileSelection(
                  event.target.files?.[0] ?? null
                )
              }
              className="sr-only"
            />

            {fileType === "pdf" ? (
              <FileText
                className="h-10 w-10 text-red-300"
                aria-hidden={true}
              />
            ) : (
              <FileSpreadsheet
                className="h-10 w-10 text-cyan-300"
                aria-hidden={true}
              />
            )}

            <div className="mt-4 text-sm font-medium text-white">
              {file
                ? file.name
                : "Drop CSV/PDF here or click to browse"}
            </div>

            <div className="mt-2 text-xs text-zinc-500">
              {file
                ? formatBytes(file.size)
                : "Supports CSV and text-based PDF files"}
            </div>
          </label>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3">
            <HeartPulse
              className="h-5 w-5 text-cyan-300"
              aria-hidden={true}
            />
          </div>

          <div className="flex-1">
            <div className="text-sm font-semibold text-cyan-200">
              Hospice Handling
            </div>

            <p className="mt-1 text-xs leading-5 text-cyan-100/70">
              System default:
              <span className="ml-1 font-medium">
                {settings.skipHospicePatientsOnRegularPages
                  ? "Skip Hospice patients"
                  : "Include Hospice patients"}
              </span>
            </p>

            <label className="mt-4 flex items-center gap-3 text-sm text-cyan-100">
              <input
                type="checkbox"
                checked={skipHospicePatients}
                disabled={uploading}
                onChange={(event) =>
                  setOverrideSkip(
                    event.target.checked
                  )
                }
              />

              Skip Hospice patients on this
              import
            </label>

            <p className="mt-2 text-xs leading-5 text-cyan-100/60">
              Hospice rows are tracked
              separately to prevent duplication
              across standard patient pages,
              rental analytics, and WIP
              reporting.
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleUpload()}
        disabled={uploading || !file}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {uploading ? (
          <>
            <Loader2
              className="h-4 w-4 animate-spin"
              aria-hidden={true}
            />
            Uploading...
          </>
        ) : (
          <>
            <Upload
              className="h-4 w-4"
              aria-hidden={true}
            />
            Upload for Server Import
          </>
        )}
      </button>

      {job ? (
        <div
          role="status"
          className="mt-6 rounded-3xl border border-white/10 bg-black/40 p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm text-zinc-400">
                Status
              </div>

              <div className="mt-1 text-lg font-semibold text-white">
                {job.status || "uploaded"}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Progress
              </div>

              <div className="mt-1 text-lg font-semibold text-white">
                {percent}%
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-sm text-zinc-400">
              <span>
                {fileSizeFormatter.format(
                  processed
                )}{" "}
                /{" "}
                {fileSizeFormatter.format(total)}{" "}
                rows
              </span>

              <span>{percent}%</span>
            </div>

            <div
              className="h-3 overflow-hidden rounded-full bg-white/10"
              aria-hidden={true}
            >
              <div
                className="h-full rounded-full bg-white transition-all duration-300"
                style={{
                  width: `${percent}%`,
                }}
              />
            </div>
          </div>

          {skippedHospiceRows > 0 ? (
            <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-200">
              Hospice skipped:{" "}
              {fileSizeFormatter.format(
                skippedHospiceRows
              )}{" "}
              row
              {skippedHospiceRows === 1
                ? ""
                : "s"}
            </div>
          ) : null}

          {job.error ? (
            <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {job.error}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}