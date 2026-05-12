import Link from "next/link";
import { Upload } from "lucide-react";

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
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
    >
      <Upload className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}