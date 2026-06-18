"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, FileText, PackageCheck, UserRound } from "lucide-react";

import { buttons, glass, spacing, tiles, typography } from "@/theme";

import { buildAssetTitleGroups } from "../lib/assetRecords";
import type { InventoryItem } from "../lib/inventoryTypes";

type InventoryAssetTilesProps = {
  items: InventoryItem[];
};

export function InventoryAssetTiles({ items }: InventoryAssetTilesProps) {
  const [expandedGroupId, setExpandedGroupId] = useState("");
  const groups = useMemo(() => buildAssetTitleGroups(items), [items]);
  const expandedGroup = groups.find((group) => group.id === expandedGroupId);

  return (
    <section className="min-w-0">
      <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className={typography.sectionTitle}>Asset Records</h2>
          <p className={`${typography.bodyMuted} mt-1`}>
            Open an asset title tile to view the patients and equipment records
            tied to that asset group.
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {groups.map((group) => {
          const expanded = group.id === expandedGroupId;

          return (
          <button
            key={group.id}
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpandedGroupId(expanded ? "" : group.id)}
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
                    {group.title}
                  </h3>
                </div>

                <p className={`${typography.smallMuted} mt-1 break-words`}>
                  {group.items.length.toLocaleString()} record
                  {group.items.length === 1 ? "" : "s"} |{" "}
                  {group.patients.length.toLocaleString()} patient
                  {group.patients.length === 1 ? "" : "s"}
                </p>
              </div>

              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${
                  expanded ? "rotate-180 text-cyan-200" : typography.caption
                }`}
                aria-hidden="true"
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <Metric label="Assets" value={group.items.length} />
              <Metric label="On Rent" value={group.onRent} />
              <Metric label="Avail" value={group.available} />
            </div>

            <div className="mt-4 flex min-w-0 flex-wrap gap-2">
              <span className={expanded ? tiles.tag : tiles.tagMuted}>
                {expanded ? "Patient list open" : "Open patient list"}
              </span>
            </div>
          </button>
        );
        })}
      </div>

      {expandedGroup ? (
        <div className={`${glass.insetPadded} mt-5`}>
          <div className="mb-4 flex min-w-0 items-center gap-3">
            <UserRound className="h-4 w-4 shrink-0 text-cyan-200" />
            <div className="min-w-0">
              <h3 className={typography.cardTitle}>{expandedGroup.title}</h3>
              <p className={`${typography.bodyMuted} mt-1`}>
                Patients and asset records compiled under this asset title.
              </p>
            </div>
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {expandedGroup.patients.map((patient) => (
              <article key={patient.id} className={glass.cardPadded}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`${typography.bodyStrong} break-words`}>
                      {patient.name}
                    </p>
                    <p className={`${typography.smallMuted} mt-1 break-words`}>
                      DOB: {patient.dob || "Not listed"}
                    </p>
                    <p className={`${typography.smallMuted} mt-1 break-words`}>
                      Phone: {patient.phone || "Not listed"}
                    </p>
                  </div>

                  <span className={tiles.badge}>
                    {patient.items.length.toLocaleString()}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {patient.items.map((item) => (
                    <div key={item.id} className={glass.insetPadded}>
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`${typography.smallMuted} break-words`}>
                            Serial {item.serial || "-"} | Asset{" "}
                            {item.assetTag || item.assetNumber || "-"}
                          </p>
                          <p className={`${typography.smallMuted} mt-1 break-words`}>
                            HCPCS {item.hcpc || "-"} | {item.status.replaceAll("_", " ")}
                          </p>
                        </div>

                        <Link
                          href={`/inventory/${encodeURIComponent(item.id)}`}
                          className={buttons.compactSecondary}
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          Asset
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {patient.id !== "unassigned" ? (
                  <Link
                    href={`/reports/patients/${encodeURIComponent(patient.id)}?tab=items`}
                    className={`${buttons.secondary} mt-4`}
                  >
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    Open Patient Record
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
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
