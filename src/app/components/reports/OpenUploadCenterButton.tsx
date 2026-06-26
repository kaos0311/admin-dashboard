import Link from "next/link";
import { Upload } from "lucide-react";

import { buttons } from "@/theme";

type OpenUploadCenterButtonProps = {
  reportType?: string;
  label?: string;
};

export default function OpenUploadCenterButton({
  reportType,
  label = "Upload Reports",
}: OpenUploadCenterButtonProps) {
  const href = reportType
    ? `/reports/upload?type=${encodeURIComponent(reportType)}`
    : "/reports/upload";

  return (
    <Link href={href} className={buttons.secondary}>
      <Upload className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
