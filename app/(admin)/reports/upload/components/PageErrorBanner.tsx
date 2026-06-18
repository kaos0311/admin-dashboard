"use client";

import { AlertTriangle, X } from "lucide-react";

import { cn } from "../upload-utils";
import { uploadUi } from "@/theme";

type PageErrorBannerProps = {
  message: string | null;
  onDismiss: () => void;
};

export function PageErrorBanner({ message, onDismiss }: PageErrorBannerProps) {
  if (!message) return null;

  return (
    <div className="rounded-3xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm text-rose-100 shadow-2xl shadow-rose-950/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />

        <div>
          <p className="font-semibold">Upload center warning</p>
          <p className="mt-1 text-rose-100/80">{message}</p>
        </div>

        <button
          type="button"
          title="Dismiss warning"
          aria-label="Dismiss warning"
          onClick={onDismiss}
          className={cn(uploadUi.buttonGhost, "ml-auto px-3 py-2")}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}



