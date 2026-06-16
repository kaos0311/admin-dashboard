"use client";

import { type RefObject, useState } from "react";
import { FileSearch, FileUp, ShieldCheck } from "lucide-react";

import { buttons, colors, glass, spacing, typography } from "@/theme";

import { getReportTypeLabel } from "../lib/orderImportDetection";
import type { ImportReportType, SmartDetectionResult } from "../lib/orderTypes";

export function ImportPanel({
  importType,
  detectedImport,
  importing,
  importMessage,
  importInputRef,
  onImportTypeChange,
  onDetectFile,
  onImportFile,
}: {
  importType: ImportReportType;
  detectedImport: SmartDetectionResult | null;
  importing: boolean;
  importMessage: string;
  importInputRef: RefObject<HTMLInputElement | null>;
  onImportTypeChange: (value: ImportReportType) => void;
  onDetectFile: (file: File | null) => void;
  onImportFile: (file: File | null) => void;
}) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  return (
    <section className={`${glass.card} ${spacing.section}`}>
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h2
            className={`inline-flex min-w-0 items-center gap-2 ${typography.sectionTitle}`}
          >
            <ShieldCheck className="h-5 w-5 shrink-0 text-cyan-200" aria-hidden />
            <span className="min-w-0 break-words">
              Smart Import Orders From Report
            </span>
          </h2>

          <p className={`${typography.bodyMuted} mt-1 max-w-3xl`}>
            Upload CSV reports. This creates a protected import job for
            Cloud Functions. Raw report history stays off this page because PHI
            is not decorative confetti.
          </p>

          {detectedImport ? (
            <div className={`${glass.inset} ${colors.infoBadge} mt-3 p-3 text-sm`}>
              <div className="font-medium">
                Detected: {getReportTypeLabel(detectedImport.reportType)}{" "}
                <span className="text-cyan-300">
                  ({Math.round(detectedImport.confidence * 100)}%)
                </span>
              </div>

              <ul className="mt-1 list-inside list-disc text-xs text-cyan-200/80">
                {detectedImport.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {pendingFile ? (
            <p className={`${typography.caption} mt-2 normal-case tracking-normal`}>
              Selected: {pendingFile.name}
            </p>
          ) : null}

          {importMessage ? (
            <p className="mt-2 text-sm font-medium text-cyan-200">
              {importMessage}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <label htmlFor="orders-report-type" className={typography.formLabel}>
              Report type
            </label>

            <select
              id="orders-report-type"
              value={importType}
              onChange={(event) =>
                onImportTypeChange(event.target.value as ImportReportType)
              }
              disabled={importing}
              className="mt-2 w-full min-w-[230px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="deliveryTickets">Delivery Tickets CSV</option>
              <option value="outstandingSalesOrders">
                Outstanding Sales Orders CSV
              </option>
              <option value="billingReview">Billing Review CSV</option>
              <option value="genericOrders">Generic Orders CSV</option>
            </select>
          </div>

          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            disabled={importing}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setPendingFile(file);
              onDetectFile(file);
            }}
            className="hidden"
            aria-label="Upload order report file"
          />

          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className={buttons.secondary}
          >
            <FileSearch className="h-4 w-4" aria-hidden />
            Choose File
          </button>

          <button
            type="button"
            onClick={() => onImportFile(pendingFile)}
            disabled={importing || !pendingFile}
            className={buttons.primary}
          >
            <FileUp className="h-4 w-4" aria-hidden />
            {importing ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </section>
  );
}



