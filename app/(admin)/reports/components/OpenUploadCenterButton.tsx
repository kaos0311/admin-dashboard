"use client";

import Link from "next/link";
import { Upload } from "lucide-react";
import type { ReactNode } from "react";

import { buttons } from "@/theme";

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
    <Link href={href} title={label} aria-label={label} className={buttons.upload}>
      <span className="shrink-0" aria-hidden="true">
        {icon ?? <Upload className="h-4 w-4" />}
      </span>

      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}
