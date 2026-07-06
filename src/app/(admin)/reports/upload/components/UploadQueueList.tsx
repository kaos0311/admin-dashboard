"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Route,
  UploadCloud,
  X,
} from "lucide-react";

import { alerts, badges, glass, typography, uploadUi } from "@/theme";

import type { UploadQueueItem } from "../upload-types";
import {
  cn,
  formatBytes,
  getFileExtension,
  isActiveUpload,
  uploadStatusLabel,
} from "../upload-utils";
const uploadQueueStyles = {
  statusDanger: badges.danger,
  statusSuccess: badges.success,
  statusInfo: badges.info,
  statusWarning: badges.warning,
  error: alerts.danger,
  preflight: alerts.info,
  preflightCard: glass.insetPadded,
  chip: glass.chip,
  iconSuccess: "text-current",
  iconWarning: typography.warningText,
  iconInfo: "text-current",
} as const;

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
        <div className="grid min-w-0 grid-cols-2 gap-2 text-center sm:grid-cols-4 sm:min-w-0 sm:max-w-[420px]">
          {[
            ["Total", uploadSummary.total],
            ["Active", uploadSummary.active],
            ["Done", uploadSummary.complete],
            ["Failed", uploadSummary.failed],
          ].map(([label, value]) => (
            <div key={label} className={cn(uploadUi.card, "min-w-0 overflow-hidden p-3")}>
              <p className={`${typography.caption} break-words`}>{label}</p>
              <p className={`${typography.metricCompact} break-words`}>{value}</p>
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
            <FileText className="mx-auto h-8 w-8" aria-hidden="true" />

            <p className={cn(typography.cardTitle, "mt-3")}>
              No files queued
            </p>

            <p className={cn(typography.bodyMuted, "mt-1")}>
              Add CSV reports to begin a batch upload.
            </p>
          </div>
        ) : (
          uploadQueue.map((item) => (
            <div key={item.id} className={cn(uploadUi.card, "p-4")}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />

                    <p className={`${typography.cardTitle} truncate`}>
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
                        ? uploadQueueStyles.statusDanger
                        : item.status === "complete"
                          ? uploadQueueStyles.statusSuccess
                          : uploadQueueStyles.statusInfo
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

              <div className="mt-4 h-2 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(0, Math.min(item.progress, 100))}%`,
                  }}
                />
              </div>

              {item.error ? (
                <p className={cn(uploadQueueStyles.error, "mt-3 px-3 py-2 text-xs")}>
                  {item.error}
                </p>
              ) : null}

              {!item.error ? (
                <div className={cn(uploadQueueStyles.preflight, "mt-4 p-3")}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className={cn("flex items-center gap-2", typography.bodyStrong)}>
                        {item.preflight ? (
                          item.preflight.status === "passed" ? (
                            <CheckCircle2 className={cn("h-4 w-4", uploadQueueStyles.iconSuccess)} aria-hidden="true" />
                          ) : (
                            <AlertTriangle className={cn("h-4 w-4", uploadQueueStyles.iconWarning)} aria-hidden="true" />
                          )
                        ) : (
                          <Loader2 className={cn("h-4 w-4 animate-spin", uploadQueueStyles.iconInfo)} aria-hidden="true" />
                        )}
                        Jarvis Header Preflight
                      </p>

                      <p className={cn(typography.bodyMuted, "mt-1 text-xs")}>
                        {item.preflight
                          ? `${item.preflight.detectedLabel} -> ${item.preflight.destinations.length.toLocaleString()} expected destination${item.preflight.destinations.length === 1 ? "" : "s"}`
                          : "Reading report headers and mapping destinations..."}
                      </p>
                    </div>

                    {item.preflight ? (
                      <span
                        className={cn(
                          uploadUi.badge,
                          item.preflight.status === "passed"
                            ? uploadQueueStyles.statusSuccess
                            : uploadQueueStyles.statusWarning,
                        )}
                      >
                        {item.preflight.status === "passed"
                          ? `${item.preflight.uploadedHeaders.length.toLocaleString()} headers found`
                          : "Review headers"}
                      </span>
                    ) : null}
                  </div>

                  {item.preflight ? (
                    <div className="mt-3 grid gap-3">
                      <div className={uploadQueueStyles.preflightCard}>
                        <p className={typography.formLabel}>
                          Detected Brightree Headers
                        </p>
                        <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-auto pr-1">
                          {item.preflight.uploadedHeaders.length > 0 ? (
                            item.preflight.uploadedHeaders.map((header) => (
                              <span
                                key={header}
                                className={uploadQueueStyles.chip}
                              >
                                {header}
                              </span>
                            ))
                          ) : (
                            <p className={cn(typography.bodyMuted, "text-xs")}>
                              No headers were detected.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className={uploadQueueStyles.preflightCard}>
                          <p className={typography.formLabel}>
                            Required Header Matches
                          </p>
                          <p className={cn(typography.bodyMuted, "mt-2 text-xs")}>
                            {item.preflight.matchedHeaders.join(", ") ||
                              "No required headers confirmed."}
                          </p>
                        </div>

                        <div className={uploadQueueStyles.preflightCard}>
                          <p className={typography.formLabel}>
                            Missing Required Groups
                          </p>
                          <p className={cn(typography.bodyMuted, "mt-2 text-xs")}>
                            {item.preflight.missingRequiredLabels.join(", ") ||
                              "None"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {item.preflight?.destinations.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.preflight.destinations.map((destination) => (
                        <span
                          key={`${destination.collection}-${destination.page}`}
                          className={cn(uploadQueueStyles.chip, "font-semibold normal-case tracking-normal")}
                        >
                          <Route className={cn("h-3.5 w-3.5", uploadQueueStyles.iconInfo)} aria-hidden="true" />
                          {destination.label}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {item.preflight?.guidance.length ? (
                    <ul className={cn("mt-3 space-y-1", typography.small)}>
                      {item.preflight.guidance.map((guidance) => (
                        <li key={guidance}>{guidance}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}




