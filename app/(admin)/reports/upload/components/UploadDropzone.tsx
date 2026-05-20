"use client";

import { useMemo, useRef, useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  UploadCloud,
} from "lucide-react";

import type {
  GroupedReportOption,
  ImportMode,
} from "../upload-types";

type UploadDropzoneProps = {
  groupedReportOptions: GroupedReportOption[];
  selectedReportType: string;
  setSelectedReportType: (value: string) => void;
  importMode: ImportMode;
  setImportMode: (value: ImportMode) => void;
  onFilesSelected: (files: File[]) => void;
};

export function UploadDropzone({
  groupedReportOptions,
  selectedReportType,
  setSelectedReportType,
  importMode,
  setImportMode,
  onFilesSelected,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [dragging, setDragging] = useState(false);

  const helperText = useMemo(() => {
    if (importMode === "overwrite_report_type") {
      return "Existing records for this report type may be replaced.";
    }

    return "Files will append into the existing report history.";
  }, [importMode]);

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;

    onFilesSelected(Array.from(files));
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl">
      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="flex-1">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload report files"
            title="Upload report files"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);

              handleFiles(event.dataTransfer.files);
            }}
            className={`group flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-[2rem] border border-dashed px-6 py-10 text-center transition ${
              dragging
                ? "border-cyan-300/40 bg-cyan-500/10"
                : "border-white/10 bg-black/20 hover:border-cyan-300/20 hover:bg-white/[0.04]"
            }`}
          >
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-5 text-cyan-200 transition group-hover:scale-105">
              <UploadCloud className="h-10 w-10" aria-hidden="true" />
            </div>

            <h2 className="mt-5 text-xl font-semibold text-white">
              Upload Reports
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400">
              Drag and drop CSV or PDF files here, or click to browse. Reports
              are staged into Storage, queued for processing, and indexed into
              Firestore collections for operations visibility.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
                <FileSpreadsheet
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />
                CSV Supported
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
                <FileText
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />
                PDF Supported
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".csv,.pdf"
              title="Upload report files"
              aria-label="Upload report files"
              className="hidden"
              onChange={(event) =>
                handleFiles(event.target.files)
              }
            />
          </div>
        </div>

        <div className="w-full rounded-[1.75rem] border border-white/10 bg-black/20 p-5 xl:max-w-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Upload Configuration
          </h3>

          <div className="mt-5 space-y-5">
            <div>
              <label
                htmlFor="reportType"
                className="mb-2 block text-sm text-neutral-300"
              >
                Report Type
              </label>

              <select
                id="reportType"
                title="Report type"
                aria-label="Report type"
                value={selectedReportType}
                onChange={(event) =>
                  setSelectedReportType(event.target.value)
                }
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/30"
              >
                {groupedReportOptions.map((group) => (
                  <optgroup
                    key={group.category}
                    label={group.category}
                  >
                    {group.options.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="importMode"
                className="mb-2 block text-sm text-neutral-300"
              >
                Import Mode
              </label>

              <select
                id="importMode"
                title="Import mode"
                aria-label="Import mode"
                value={importMode}
                onChange={(event) =>
                  setImportMode(
                    event.target.value as ImportMode
                  )
                }
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/30"
              >
                <option value="append">
                  Append Data
                </option>

                <option value="overwrite_report_type">
                  Overwrite Report Type
                </option>
              </select>

              <p className="mt-2 text-xs leading-5 text-neutral-500">
                {helperText}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-400/15 bg-amber-500/10 p-4">
              <p className="text-xs leading-5 text-amber-100">
                Overwrite mode should only be used for authoritative weekly
                imports. Otherwise you risk duplicate churn, broken analytics,
                and eventually someone yelling in a meeting while staring at
                spreadsheets like they’re ancient prophecy tablets.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}