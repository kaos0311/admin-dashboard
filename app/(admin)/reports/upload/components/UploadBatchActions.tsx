"use client";

import {
  Play,
  RotateCcw,
  Trash2,
} from "lucide-react";

type UploadBatchActionsProps = {
  disabled: boolean;
  uploading: boolean;
  queueCount: number;
  failedCount: number;
  completedCount: number;
  onStartUpload: () => void;
  onRetryFailed: () => void;
  onClearCompleted: () => void;
};

export function UploadBatchActions({
  disabled,
  uploading,
  queueCount,
  failedCount,
  completedCount,
  onStartUpload,
  onRetryFailed,
  onClearCompleted,
}: UploadBatchActionsProps) {
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl">
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={onStartUpload}
        className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Play className="h-4 w-4" aria-hidden="true" />
        {uploading ? "Uploading..." : "Start Upload"}
      </button>

      <button
        type="button"
        disabled={!failedCount}
        onClick={onRetryFailed}
        className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Retry Failed ({failedCount})
      </button>

      <button
        type="button"
        disabled={!completedCount}
        onClick={onClearCompleted}
        className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Clear Completed ({completedCount})
      </button>

      <div className="ml-auto text-sm text-neutral-400">
        Queue Size:{" "}
        <span className="font-semibold text-white">
          {queueCount}
        </span>
      </div>
    </section>
  );
}