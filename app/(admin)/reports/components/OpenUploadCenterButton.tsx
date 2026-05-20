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
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 shadow-lg shadow-cyan-950/20 transition hover:border-cyan-200/40 hover:bg-cyan-400/15 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
    >
      {icon ?? <Upload className="h-4 w-4" aria-hidden="true" />}
      {label}
    </Link>
  );
}