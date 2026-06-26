"use client";

import { FileArchive, UploadCloud } from "lucide-react";
import type { RefObject } from "react";

import { typography, uploadUi } from "@/theme";

import { cn } from "../upload-utils";
type UploadDropzoneProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  hasActiveUploads: boolean;
  onFilesSelected: (files: FileList | File[]) => void;
};

export function UploadDropzone({
  fileInputRef,
  hasActiveUploads,
  onFilesSelected,
}: UploadDropzoneProps) {
  return (
    <div className={cn(uploadUi.panel, "p-5 sm:p-6")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className={cn(uploadUi.badge, "mb-3 w-fit")}>
            <FileArchive className="h-3.5 w-3.5" aria-hidden="true" />
            Batch upload
          </div>

          <h2 className={typography.sectionTitle}>Upload CSV reports</h2>

          <p className={cn(typography.bodyMuted, "mt-2 max-w-2xl")}>
            Files are validated locally, uploaded with Firebase Storage progress,
            then linked to importJobs for backend processing.
          </p>
        </div>

        <button
          type="button"
          title="Choose CSV report files"
          aria-label="Choose CSV report files"
          className={uploadUi.buttonPrimary}
          disabled={hasActiveUploads}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud className="h-4 w-4" aria-hidden="true" />
          Choose files
        </button>

        <label htmlFor="report-upload-files" className="sr-only">
          Choose CSV report files
        </label>

        <input
          id="report-upload-files"
          ref={fileInputRef}
          name="reportUploadFiles"
          type="file"
          title="Choose CSV report files"
          aria-label="Choose CSV report files"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) {
              onFilesSelected(event.target.files);
              event.target.value = "";
            }
          }}
        />
      </div>

      <div
        className="mt-6 rounded-3xl border border-dashed border-white/20 bg-white/[0.045] p-8 text-center transition hover:border-white/30 hover:bg-white/[0.06]"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onFilesSelected(event.dataTransfer.files);
        }}
      >
        <div className={cn(uploadUi.icon, "mx-auto")}>
          <UploadCloud className="h-6 w-6" aria-hidden="true" />
        </div>

        <h3 className={cn(typography.cardTitle, "mt-4")}>
          Drop reports here
        </h3>

        <p className={cn(typography.bodyMuted, "mx-auto mt-2 max-w-xl")}>
          Supports batch CSV uploads up to 50 MB each.
        </p>
      </div>
    </div>
  );
}



