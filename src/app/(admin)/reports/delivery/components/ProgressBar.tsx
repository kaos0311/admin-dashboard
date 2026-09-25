"use client";

import { typography } from "@/theme";
import { deliveryStyles, progressPercent } from "../lib/deliveryUtils";

type ProgressBarProps = {
  label: string;
  value: number;
  total: number;
};

export function ProgressBar({ label, value, total }: ProgressBarProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className={typography.bodyStrong}>{label}</span>
        <span className={typography.smallMuted}>
          {value}/{total}
        </span>
      </div>
      <div className={deliveryStyles.progressTrack}>
        <div
          className={deliveryStyles.progressFill}
          style={{ width: `${progressPercent(value, total)}%` }}
        />
      </div>
    </div>
  );
}
