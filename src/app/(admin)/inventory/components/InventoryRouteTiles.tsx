import Link from "next/link";
import { Building2, PackageCheck } from "lucide-react";

import { buttons, glass, tiles, typography } from "@/theme";

export function AssetRecordsRouteTile({ visibleCount }: { visibleCount: number }) {
  return (
    <Link
      href="/inventory/asset-records"
      className={`${glass.cardPadded} group flex min-w-0 flex-col gap-4 transition hover:-translate-y-0.5 hover:border-[#7a9a5e]/35 hover:bg-[#242424] sm:flex-row sm:items-center sm:justify-between`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={tiles.icon}>
          <PackageCheck className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <p className={tiles.label}>Moved to dedicated page</p>
          <h2 className={`${typography.cardTitle} mt-1`}>Asset Records</h2>
          <p className={`${typography.bodyMuted} mt-1`}>
            Open asset title groups, patient links, serials, HCPCS, and asset
            detail records away from the active inventory workspace.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className={tiles.badge}>
          {visibleCount.toLocaleString()} visible assets
        </span>
        <span className={buttons.compactSecondary}>Open</span>
      </div>
    </Link>
  );
}

export function RentalPropertyRouteTile({ visibleCount }: { visibleCount: number }) {
  return (
    <Link
      href="/inventory/rental-property"
      className={`${glass.cardPadded} group flex min-w-0 flex-col gap-4 transition hover:-translate-y-0.5 hover:border-[#7a9a5e]/35 hover:bg-[#242424] sm:flex-row sm:items-center sm:justify-between`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={tiles.icon}>
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <p className={tiles.label}>Moved to dedicated page</p>
          <h2 className={`${typography.cardTitle} mt-1`}>
            Insurance Rental Property
          </h2>
          <p className={`${typography.bodyMuted} mt-1`}>
            Review Hospice and insurance rental patients without crowding the
            active inventory records.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className={tiles.badge}>
          {visibleCount.toLocaleString()} visible rentals
        </span>
        <span className={buttons.compactSecondary}>Open</span>
      </div>
    </Link>
  );
}