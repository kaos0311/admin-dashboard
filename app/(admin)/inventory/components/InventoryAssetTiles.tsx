"use client";

import Link from "next/link";
import { PackageCheck } from "lucide-react";

import { glass, spacing, tiles, typography } from "@/theme";

import type { InventoryItem } from "../lib/inventoryTypes";

type InventoryAssetTilesProps = {
  items: InventoryItem[];
};

export function InventoryAssetTiles({ items }: InventoryAssetTilesProps) {
  return (
    <section className="min-w-0">
      <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className={typography.sectionTitle}>Asset Records</h2>
          <p className={`${typography.bodyMuted} mt-1`}>
            Open an asset tile to view the patient and rental records tied to
            that specific serial or asset number.
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/inventory/${encodeURIComponent(item.id)}`}
            className={`${glass.cardPadded} ${glass.cardHover} block text-left`}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={spacing.inline}>
                  <PackageCheck
                    className={`h-4 w-4 shrink-0 ${typography.caption}`}
                    aria-hidden="true"
                  />
                  <h3 className={`${typography.cardTitle} truncate`}>
                    {item.name || "Unnamed asset"}
                  </h3>
                </div>

                <p className={`${typography.smallMuted} mt-1 break-words`}>
                  SN: {item.serial || "-"} | Asset:{" "}
                  {item.assetTag || item.assetNumber || "-"}
                </p>
              </div>

              <span className={tiles.badge}>{item.status.replaceAll("_", " ")}</span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <Metric label="HCPCS" value={item.hcpc || "-"} />
              <Metric label="On Rent" value={item.onRent} />
              <Metric label="Avail" value={item.available} />
            </div>

            <div className="mt-4 flex min-w-0 flex-wrap gap-2">
              {item.patientName ? (
                <span className={tiles.tag}>{item.patientName}</span>
              ) : (
                <span className={tiles.tagMuted}>No patient assigned</span>
              )}

              {item.insuranceName ? (
                <span className={tiles.tagMuted}>{item.insuranceName}</span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={glass.insetPadded}>
      <p className={typography.caption}>{label}</p>
      <p className={`mt-1 truncate ${typography.bodyStrong}`}>{value}</p>
    </div>
  );
}
