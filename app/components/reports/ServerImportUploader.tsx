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

import { alerts, buttons, colors, forms, glass, spacing, typography } from "@/theme";
import { REPORT_TYPES, type ReportType } from "@/lib/reportTypes";

import {
  type ImportJobSnapshot,
  uploadFileForServerImport,
  watchImportJob,
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
  const [reportType, setReportType] = useState<ReportType>("custom");
  const [overrideSkip, setOverrideSkip] = useState<boolean | null>(null);
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState<ImportJobSnapshot | null>(null);
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
      ? Math.min(100, Math.round((processed / total) * 100))
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
      toast.error("Only CSV and PDF files are supported.");
      return false;
    }

    const maxSizeMb = 50;

    if (selectedFile.size > maxSizeMb * 1024 * 1024) {
      toast.error(`File exceeds ${maxSizeMb}MB upload limit.`);
      return false;
    }

    return true;
  }

  function handleFileSelection(selectedFile: File | null) {
    if (!selectedFile) return;

    if (!validateFile(selectedFile)) {
      return;
    }

    setFile(selectedFile);
  }

  async function handleUpload() {
    if (!file) {
      toast.error("Choose a CSV or PDF file first.");
      return;
    }

    try {
      setUploading(true);
      setJob(null);

      const result = await uploadFileForServerImport({
        file,
        reportType,
        skipHospicePatients,
      });

      setJobId(result.jobId);

      toast.success(
        `${fileType === "pdf" ? "PDF" : "CSV"} uploaded. Server import started.`
      );

      setFile(null);
    } catch (error) {
      console.error("SERVER IMPORT UPLOAD ERROR:", error);

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
      className={[glass.cardPadded, spacing.section].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={typography.sectionTitle}>
            Server Report Import
          </h2>

          <p className={["mt-1 max-w-2xl", typography.bodyMuted].join(" ")}>
            Upload CSV or text-based PDF files. Raw files are stored in Firebase
            Storage while parsed rows are indexed into Firestore analytics.
          </p>
        </div>

        <div className={["px-4 py-3 text-right", glass.insetPadded].join(" ")}>
          <div className={typography.caption}>
            Import Mode
          </div>

          <div className={["mt-1", typography.bodyStrong].join(" ")}>
            Server Processing
          </div>
        </div>
      </div>

      <div className={["mt-6", spacing.gridTwo].join(" ")}>
        <div className={forms.field}>
          <label
            htmlFor="server-report-type"
            className={forms.label}
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
              setReportType(event.target.value as ReportType)
            }
            className={forms.select}
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

        <div className={forms.field}>
          <div className={forms.label}>
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

              const droppedFile = event.dataTransfer.files?.[0];

              handleFileSelection(droppedFile ?? null);
            }}
            className={[
              "flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed p-6 text-center transition",
              dragging
                ? colors.infoBadge
                : [colors.border, colors.surfaceInset, colors.surfaceHover].join(" "),
            ].join(" ")}
          >
            <input
              id="server-import-file"
              type="file"
              accept=".csv,.pdf,text/csv,application/pdf"
              disabled={uploading}
              onChange={(event) =>
                handleFileSelection(event.target.files?.[0] ?? null)
              }
              className="sr-only"
            />

            {fileType === "pdf" ? (
              <FileText
                className={["h-10 w-10", colors.dangerPulse].join(" ")}
                aria-hidden={true}
              />
            ) : (
              <FileSpreadsheet
                className={["h-10 w-10", colors.pulse].join(" ")}
                aria-hidden={true}
              />
            )}

            <div className={["mt-4", typography.bodyStrong].join(" ")}>
              {file ? file.name : "Drop CSV/PDF here or click to browse"}
            </div>

            <div className={["mt-2", typography.smallMuted].join(" ")}>
              {file ? formatBytes(file.size) : "Supports CSV and text-based PDF files"}
            </div>
          </label>
        </div>
      </div>

      <div className={["mt-5", alerts.info].join(" ")}>
        <div className="flex items-start gap-4">
          <div className={["p-3", glass.iconBoxSm].join(" ")}>
            <HeartPulse
              className="h-5 w-5"
              aria-hidden={true}
            />
          </div>

          <div className="flex-1">
            <div className={typography.bodyStrong}>
              Hospice Handling
            </div>

            <p className={["mt-1", typography.small].join(" ")}>
              System default:
              <span className="ml-1 font-medium">
                {settings.skipHospicePatientsOnRegularPages
                  ? "Skip Hospice patients"
                  : "Include Hospice patients"}
              </span>
            </p>

            <label className={["mt-4 flex items-center gap-3", typography.body].join(" ")}>
              <input
                type="checkbox"
                checked={skipHospicePatients}
                disabled={uploading}
                onChange={(event) =>
                  setOverrideSkip(event.target.checked)
                }
              />

              Skip Hospice patients on this import
            </label>

            <p className={["mt-2", typography.small].join(" ")}>
              Hospice rows are tracked separately to prevent duplication across
              standard patient pages, rental analytics, and WIP reporting.
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleUpload()}
        disabled={uploading || !file}
        className={["mt-5", buttons.primary].join(" ")}
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
          className={["mt-6", glass.insetPadded].join(" ")}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className={typography.bodyMuted}>
                Status
              </div>

              <div className={["mt-1", typography.cardTitle].join(" ")}>
                {job.status || "uploaded"}
              </div>
            </div>

            <div className={["px-4 py-3 text-right", glass.insetPadded].join(" ")}>
              <div className={typography.caption}>
                Progress
              </div>

              <div className={["mt-1", typography.cardTitle].join(" ")}>
                {percent}%
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className={["mb-2 flex items-center justify-between", typography.bodyMuted].join(" ")}>
              <span>
                {fileSizeFormatter.format(processed)} /{" "}
                {fileSizeFormatter.format(total)} rows
              </span>

              <span>{percent}%</span>
            </div>

            <div
              className={glass.progressTrack}
              aria-hidden={true}
            >
              <div
                className={glass.progressFill}
                style={{
                  width: `${percent}%`,
                }}
              />
            </div>
          </div>

          {skippedHospiceRows > 0 ? (
            <div className={["mt-5", alerts.info].join(" ")}>
              Hospice skipped: {fileSizeFormatter.format(skippedHospiceRows)} row
              {skippedHospiceRows === 1 ? "" : "s"}
            </div>
          ) : null}

          {job.error ? (
            <div className={["mt-5", alerts.danger].join(" ")}>
              {job.error}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

