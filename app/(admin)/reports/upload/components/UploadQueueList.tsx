"use client";

import { FileText, Loader2, UploadCloud, X } from "lucide-react";

import { typography } from "@/theme";

import type { UploadQueueItem } from "../upload-types";
import {
  cn,
  formatBytes,
  getFileExtension,
  isActiveUpload,
  uploadStatusLabel,
} from "../upload-utils";
import { uploadUi } from "./upload-ui";

type UploadQueueListProps = {
  uploadQueue: UploadQueueItem[];
  uploadSummary: {
    total: number;
    active: number;
    complete: number;
    failed: number;
  };
  hasActiveUploads: boolean;
  onClearCompletedUploads: () => void;
  onStartUploads: () => void;
  onRemoveQueuedUpload: (id: string) => void;
};

export function UploadQueueList({
  uploadQueue,
  uploadSummary,
  hasActiveUploads,
  onClearCompletedUploads,
  onStartUploads,
  onRemoveQueuedUpload,
}: UploadQueueListProps) {
  return (
    <div className={cn(uploadUi.panel, "p-5 sm:p-6")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-4 gap-2 text-center sm:min-w-[420px]">
          {[
            ["Total", uploadSummary.total],
            ["Active", uploadSummary.active],
            ["Done", uploadSummary.complete],
            ["Failed", uploadSummary.failed],
          ].map(([label, value]) => (
            <div key={label} className={cn(uploadUi.card, "p-3")}>
              <p className={typography.caption}>{label}</p>
              <p className="mt-1 text-lg font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            title="Clear completed and failed uploads"
            aria-label="Clear completed and failed uploads"
            className={uploadUi.buttonGhost}
            onClick={onClearCompletedUploads}
            disabled={hasActiveUploads || uploadQueue.length === 0}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Clear done
          </button>

          <button
            type="button"
            title="Start queued uploads"
            aria-label="Start queued uploads"
            className={uploadUi.buttonPrimary}
            onClick={onStartUploads}
            disabled={
              hasActiveUploads ||
              uploadQueue.every((item) => item.status !== "idle")
            }
          >
            {hasActiveUploads ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
            )}
            Start upload
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {uploadQueue.length === 0 ? (
          <div className={cn(uploadUi.card, "p-6 text-center")}>
            <FileText className="mx-auto h-8 w-8 text-white/45" aria-hidden="true" />

            <p className={cn(typography.cardTitle, "mt-3")}>
              No files queued
            </p>

            <p className={cn(typography.bodyMuted, "mt-1")}>
              Add CSV or PDF reports to begin a batch upload.
            </p>
          </div>
        ) : (
          uploadQueue.map((item) => (
            <div key={item.id} className={cn(uploadUi.card, "p-4")}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-slate-200" aria-hidden="true" />

                    <p className="truncate font-semibold text-white">
                      {item.file.name}
                    </p>
                  </div>

                  <p className={cn(typography.bodyMuted, "mt-1 text-xs")}>
                    {formatBytes(item.file.size)} â€¢{" "}
                    {item.file.type ||
                      getFileExtension(item.file.name).toUpperCase()}
                    {item.jobId ? ` â€¢ Job ${item.jobId}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      uploadUi.badge,
                      item.status === "failed"
                        ? "border-rose-300/25 bg-rose-400/10 text-rose-100"
                        : item.status === "complete"
                          ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                          : "border-sky-300/25 bg-sky-400/10 text-sky-100"
                    )}
                  >
                    {isActiveUpload(item.status) ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : null}

                    {uploadStatusLabel(item.status)}
                  </span>

                  {!isActiveUpload(item.status) ? (
                    <button
                      type="button"
                      title={`Remove ${item.file.name} from upload queue`}
                      aria-label={`Remove ${item.file.name} from upload queue`}
                      className={cn(uploadUi.buttonGhost, "px-3 py-2")}
                      onClick={() => onRemoveQueuedUpload(item.id)}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white/80 transition-all duration-300"
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
  );
}


