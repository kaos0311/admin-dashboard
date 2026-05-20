"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import type { UploadStep } from "../upload-types";
import { getStepLabel, isActiveStep } from "../upload-utils";

type StatusBadgeProps = {
  step: UploadStep;
};

export function StatusBadge({ step }: StatusBadgeProps) {
  const label = getStepLabel(step);

  const className =
    step === "complete"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      : step === "failed"
        ? "border-red-400/20 bg-red-500/10 text-red-200"
        : isActiveStep(step)
          ? "border-blue-400/20 bg-blue-500/10 text-blue-200"
          : "border-white/10 bg-white/5 text-neutral-300";

  const icon =
    step === "complete" ? (
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
    ) : step === "failed" ? (
      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
    ) : isActiveStep(step) ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
    ) : null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}