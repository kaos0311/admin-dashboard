"use client";

import { useState, type RefObject } from "react";
import { FileSearch, FileUp, ShieldCheck } from "lucide-react";

import { getReportTypeLabel } from "../lib/orderImportDetection";
import {
  glassButton,
  glassPanel,
  glassSelect,
  labelText,
  primaryButton,
} from "../lib/orderUi";
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
    <section className={`${glassPanel} p-5`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldCheck className="h-5 w-5 text-cyan-200" aria-hidden={true} />
            Smart Import Orders From Report
          </h2>

          <p className="mt-1 max-w-3xl text-sm text-zinc-400">
            Upload CSV/PDF reports. This creates a protected import job for
            Cloud Functions. Raw report history stays off this page because PHI
            is not decorative confetti.
          </p>

          {detectedImport ? (
            <div className="mt-3 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-sm text-cyan-100 shadow-inner shadow-cyan-950/20 backdrop-blur-xl">
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
            <p className="mt-2 text-xs text-zinc-500">
              Selected: {pendingFile.name}
            </p>
          ) : null}

          {importMessage ? (
            <p className="mt-2 text-sm font-medium text-cyan-200">
              {importMessage}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label htmlFor="orders-report-type" className={labelText}>
              Report type
            </label>

            <select
              id="orders-report-type"
              value={importType}
              onChange={(event) =>
                onImportTypeChange(event.target.value as ImportReportType)
              }
              disabled={importing}
              className={glassSelect}
            >
              <option value="deliveryTickets">Delivery Tickets PDF</option>
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
            accept=".csv,.pdf,text/csv,application/pdf"
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
            className={glassButton}
          >
            <FileSearch className="h-4 w-4" aria-hidden={true} />
            Choose File
          </button>

          <button
            type="button"
            onClick={() => onImportFile(pendingFile)}
            disabled={importing || !pendingFile}
            className={primaryButton}
          >
            <FileUp className="h-4 w-4" aria-hidden={true} />
            {importing ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </section>
  );
}