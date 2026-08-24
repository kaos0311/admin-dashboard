"use client";

import Link from "next/link";
import type { PatientWithDerived } from "../../patients/lib/patientTypes";
import { formatDate } from "../../patients/lib/patientUtils";
import { cx } from "../lib/cpapUtils";
import type { StatTile, StatTileId } from "../types";
import { badges, glass, spacing, typography } from "@/theme";

type Props = {
  statTiles: StatTile[];
  expandedStatTile: StatTileId | null;
  onToggleStatTile: (id: StatTileId) => void;
};

export function StatTileGrid({ statTiles, expandedStatTile, onToggleStatTile }: Props) {
  const activeStat = statTiles.find((tile) => tile.id === expandedStatTile) ?? null;

  return (
    <>
      <section className={spacing.gridResponsive}>
        {statTiles.map((tile) => {
          const selected = expandedStatTile === tile.id;
          return (
            <button
              key={tile.id}
              type="button"
              aria-expanded={selected}
              onClick={() => onToggleStatTile(tile.id)}
              className={cx(
                glass.statCard,
                glass.cardHover,
                "min-w-0 text-left",
                selected && "ring-1 ring-cyan-300/60",
              )}
            >
              <span className={typography.caption}>{tile.label}</span>
              <span className={cx(typography.metricCompact, "mt-2 block")}>
                {tile.value.toLocaleString()}
              </span>
              <span className={cx(typography.smallMuted, "mt-2 block")}>
                {selected ? "Hide patients" : "Show patients"}
              </span>
            </button>
          );
        })}
      </section>

      {activeStat ? (
        <section className={glass.panelPadded}>
          <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className={typography.cardTitle}>{activeStat.label}</h2>
              <p className={cx(typography.smallMuted, "mt-1")}>
                Unique patients counted in this CPAP calendar tile.
              </p>
            </div>
            <span className={glass.chip}>
              {activeStat.patients.length.toLocaleString()} patients
            </span>
          </div>

          {activeStat.patients.length === 0 ? (
            <p className={cx(glass.emptyState, "text-center")}>No patients found for this tile.</p>
          ) : (
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {activeStat.patients.map((patient: PatientWithDerived) => (
                <Link
                  key={`${activeStat.id}-${patient.id}`}
                  href={`/reports/patients/${patient.id}?tab=items`}
                  className={cx(glass.insetPadded, glass.cardHover, "block min-w-0")}
                >
                  <p className={cx(typography.bodyStrong, "break-words")}>
                    {patient.fullName || "Unnamed Patient"}
                  </p>
                  <dl className="mt-3 grid min-w-0 gap-2">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <dt className={typography.caption}>DOB</dt>
                      <dd className={cx(typography.small, "break-words text-right")}>
                        {formatDate(patient.dateOfBirth || patient.dob)}
                      </dd>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <dt className={typography.caption}>Phone</dt>
                      <dd className={cx(typography.small, "break-words text-right")}>
                        {patient.phone || "No phone listed"}
                      </dd>
                    </div>
                  </dl>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
