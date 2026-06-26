"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { badges } from "@/theme";
import type { UploadStep } from "../upload-types";
import { getStepLabel, isActiveStep } from "../upload-utils";

type StatusBadgeProps = {
  step: UploadStep;
};

export function StatusBadge({ step }: StatusBadgeProps) {
  const label = getStepLabel(step);

  const className =
    step === "complete"
      ? badges.success
      : step === "failed"
        ? badges.danger
        : isActiveStep(step)
          ? badges.info
          : badges.neutral;

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



