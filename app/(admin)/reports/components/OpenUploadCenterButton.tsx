"use client";

import Link from "next/link";
import { Upload } from "lucide-react";
import type { ReactNode } from "react";

type OpenUploadCenterButtonProps = {
  reportType?: string;
  label?: string;
  icon?: ReactNode;
};

export default function OpenUploadCenterButton({
  reportType,
  label = "Open Upload Center",
  icon,
}: OpenUploadCenterButtonProps) {
  const href = reportType
    ? `/reports/upload?reportType=${encodeURIComponent(reportType)}`
    : "/reports/upload";

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={[
        "inline-flex min-w-0 items-center justify-center gap-2",
        "rounded-2xl border border-cyan-300/20",
        "bg-cyan-400/10 px-4 py-3",
        "text-sm font-semibold text-cyan-100",
        "shadow-lg shadow-cyan-950/20",
        "transition-all duration-200",
        "hover:border-cyan-200/40 hover:bg-cyan-400/15",
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-cyan-300/40",
        "focus-visible:ring-offset-2",
        "focus-visible:ring-offset-slate-950",
      ].join(" ")}
    >
      <span
        className="shrink-0"
        aria-hidden="true"
      >
        {icon ?? <Upload className="h-4 w-4" />}
      </span>

      <span className="min-w-0 truncate">
        {label}
      </span>
    </Link>
  );
}



