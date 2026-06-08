"use client";

import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

export function AdminSystemAlerts() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="border-b border-amber-300/10 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />

          <span className="truncate">
            System reminder: review stuck imports and hospice classification
            before trusting analytics like they came down from a mountain carved
            in stone.
          </span>

          <Link
            href="/reports/upload"
            className="hidden font-semibold underline-offset-4 hover:underline sm:inline"
          >
            Review uploads
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          title="Dismiss system alert"
          aria-label="Dismiss system alert"
          className="rounded-lg p-1 text-amber-100/70 transition hover:bg-white/10 hover:text-amber-100"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}



