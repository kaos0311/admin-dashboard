import Link from "next/link";

import { metricActionButtonClass, tiles } from "@/theme";

type MiniCardProps = {
  title: string;
  value: number;
  href: string;
  tone?: "red" | "orange" | "blue" | "yellow" | "success";
};

export function MiniCard({
  title,
  value,
  href,
  tone = "blue",
}: MiniCardProps) {
  return (
    <Link
      href={href}
      className={`${tiles.base} ${tiles.compact} ${tiles.hover} min-h-[10.75rem] min-w-0 focus:outline-none focus:ring-2 focus:ring-[#7a9a5e]/40`}
    >
      <div className="min-w-0">
        <p className={tiles.metricLabel} title={title}>{title}</p>

        <p className="mt-2 min-w-0 break-words text-2xl font-black leading-[1.15] tracking-tight text-white">
          {value}
        </p>

        <span className={metricActionButtonClass(tone)}>
          View
        </span>
      </div>
    </Link>
  );
}
