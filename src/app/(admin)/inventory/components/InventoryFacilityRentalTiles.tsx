"use client";

import Link from "next/link";
import { Building2, HeartHandshake, UsersRound } from "lucide-react";

import { glass, tiles, typography } from "@/theme";

import type { RentalFacilityTile } from "../lib/rentalProperty";

type InventoryFacilityRentalTilesProps = {
  tiles: RentalFacilityTile[];
  selectedTileId: string;
  onSelect: (tileId: string) => void;
  onClear: () => void;
};

export function InventoryFacilityRentalTiles({
  tiles: facilityTiles,
  selectedTileId,
  onSelect,
  onClear,
}: InventoryFacilityRentalTilesProps) {
  if (facilityTiles.length === 0) {
    return (
      <section className={`${glass.insetPadded} ${typography.bodyMuted}`}>
        No insurance rental property is visible under the current inventory
        filters.
      </section>
    );
  }

  const selectedTile = facilityTiles.find((tile) => tile.id === selectedTileId);

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className={typography.sectionTitle}>Insurance Rental Property</h2>
          <p className={`${typography.bodyMuted} mt-1`}>
            Open Hospice or an insurance tile to review the patients associated
            with that rental property.
          </p>
        </div>

        {selectedTile ? (
          <button
            type="button"
            className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/35 hover:bg-white/[0.09]"
            onClick={onClear}
          >
            Close patient list
          </button>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {facilityTiles.map((facilityTile) => {
          const selected = facilityTile.id === selectedTileId;
          const Icon = facilityTile.hospice ? HeartHandshake : Building2;

          return (
            <button
              key={facilityTile.id}
              type="button"
              onClick={() => onSelect(facilityTile.id)}
              className={[
                glass.cardPadded,
                "text-left transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50",
                selected ? "border-cyan-300/45 bg-cyan-300/[0.12]" : "",
              ].join(" ")}
              aria-pressed={selected}
              aria-label={`Show rental patients for ${facilityTile.label}`}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={tiles.icon}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>

                  <div className="min-w-0">
                    <p className={tiles.label}>
                      {facilityTile.hospice ? "Hospice" : "Insurance"}
                    </p>
                    <h3 className={`${typography.cardTitle} mt-1 break-words`}>
                      {facilityTile.label}
                    </h3>
                  </div>
                </div>

                <span className={tiles.badge}>
                  {facilityTile.items.length.toLocaleString()}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <Metric label="Assets" value={facilityTile.items.length} />
                <Metric label="Patients" value={facilityTile.patientCount} />
                <Metric label="On Rent" value={facilityTile.totalOnRent} />
              </div>
            </button>
          );
        })}
      </div>

      {selectedTile ? (
        <div className={glass.insetPadded}>
          <div className="mb-4 flex min-w-0 items-center gap-3">
            <UsersRound className="h-4 w-4 shrink-0 text-cyan-200" />
            <div className="min-w-0">
              <h3 className={typography.cardTitle}>
                {selectedTile.label} Patients
              </h3>
              <p className={`${typography.bodyMuted} mt-1`}>
                {selectedTile.patients.length.toLocaleString()} patient
                {selectedTile.patients.length === 1 ? "" : "s"} associated with
                this insurance rental property.
              </p>
            </div>
          </div>

          {selectedTile.patients.length === 0 ? (
            <p className={typography.bodyMuted}>
              No patient names are attached to the visible rental records for
              this insurance tile.
            </p>
          ) : (
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {selectedTile.patients.map((patient) => {
                const content = (
                  <>
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
                        {patient.assetCount.toLocaleString()}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <Metric label="Assets" value={patient.assetCount} />
                      <Metric label="On Rent" value={patient.onRent} />
                    </div>
                  </>
                );

                return patient.id !== patient.name ? (
                  <Link
                    key={patient.id}
                    href={`/reports/patients/${encodeURIComponent(patient.id)}`}
                    className={`${glass.cardPadded} block transition hover:border-cyan-300/35 hover:bg-white/[0.07]`}
                  >
                    {content}
                  </Link>
                ) : (
                  <article key={patient.id} className={glass.cardPadded}>
                    {content}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className={`${glass.insetPadded} flex min-w-0 items-center gap-3`}>
          <UsersRound className="h-4 w-4 shrink-0 text-cyan-200" />
          <p className={typography.bodyMuted}>
            No insurance selected. Inventory records below remain controlled by
            the normal filters.
          </p>
        </div>
      )}
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
