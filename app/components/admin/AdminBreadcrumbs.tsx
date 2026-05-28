"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { usePathname } from "next/navigation";

function toTitle(value: string): string {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AdminBreadcrumbs() {
  const pathname = usePathname();

  const parts = pathname.split("/").filter(Boolean);

  return (
    <nav
      aria-label="Breadcrumb"
      className="mt-0.5 flex items-center gap-1 text-xs text-white/50"
    >
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 transition hover:text-white"
      >
        <Home className="h-3.5 w-3.5" aria-hidden="true" />
        Dashboard
      </Link>

      {parts
        .filter((part) => part !== "dashboard")
        .map((part, index) => {
          const href = `/${parts.slice(0, index + 1).join("/")}`;

          return (
            <span key={`${part}-${href}`} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <Link href={href} className="transition hover:text-white">
                {toTitle(part)}
              </Link>
            </span>
          );
        })}
    </nav>
  );
}
