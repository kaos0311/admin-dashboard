"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { ArrowLeft, Building2, RefreshCcw } from "lucide-react";

import { buttons, colors, glass, tiles, typography } from "@/theme";

import { useAuthRole } from "@/app/hooks/useAuthRole";
import { hasPermission } from "@/lib/permissions/roles";

import { InventoryEmptyState } from "../components/InventoryEmptyState";
import { InventoryFacilityRentalTiles } from "../components/InventoryFacilityRentalTiles";
import { InventoryLoadingState } from "../components/InventoryLoadingState";
import { useInventoryData } from "../hooks/useInventoryData";
import { buildRentalFacilityTiles } from "../lib/rentalProperty";

export default function InventoryRentalPropertyPage() {
  const {
    loading: authLoading,
    role,
    canAccessCommandCenter,
  } = useAuthRole();

  const canRead =
    canAccessCommandCenter &&
    hasPermission(role, "inventory:read");

  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedFacilityTileId, setSelectedFacilityTileId] = useState("");

  const {
    items,
    loading,
    lastLoadedAt,
  } = useInventoryData({
    authLoading,
    canRead,
    refreshKey,
  });

  const rentalFacilityTiles = useMemo(
    () => buildRentalFacilityTiles(items),
    [items]
  );

  const totals = useMemo(
    () =>
      rentalFacilityTiles.reduce(
        (summary, tile) => ({
          assets: summary.assets + tile.items.length,
          patients: summary.patients + tile.patientCount,
          onRent: summary.onRent + tile.totalOnRent,
        }),
        { assets: 0, patients: 0, onRent: 0 }
      ),
    [rentalFacilityTiles]
  );

  function handleRefresh() {
    setRefreshKey((current) => current + 1);
  }

  return (
    <main className={`${glass.page} ${colors.app}`}>
      <div className={colors.grid} />

      <div className={glass.shell}>
        <section className={`${glass.panel} relative overflow-hidden p-5 sm:p-6`}>
          <div className={colors.grid} />

          <div className="relative flex min-w-0 flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <Link href="/inventory" className={buttons.compactSecondary}>
                <ArrowLeft className="h-4 w-4" />
                Inventory
              </Link>

              <div className="mt-5 flex min-w-0 items-start gap-4">
                <span className={tiles.icon}>
                  <Building2 className="h-6 w-6" aria-hidden="true" />
                </span>

                <div className="min-w-0">
                  <p className={tiles.label}>Inventory rental property</p>
                  <h1 className="mt-2 break-words text-3xl font-bold tracking-tight">
                    Insurance Rental Property
                  </h1>
                  <p className={`${typography.bodyMuted} mt-2 max-w-3xl`}>
                    Hospice and insurance rental property grouped by payer, with
                    callable patient lists connected to the inventory pipeline.
                  </p>
                  <p className={`mt-2 text-xs ${typography.caption}`}>
                    {lastLoadedAt
                      ? `Last synced: ${lastLoadedAt.toLocaleTimeString()}`
                      : "Waiting for rental property sync..."}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              className={buttons.secondary}
            >
              <RefreshCcw className="h-4 w-4" />
              Resync
            </button>
          </div>

          <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
            <SummaryMetric label="Rental Assets" value={totals.assets} />
            <SummaryMetric label="Patients" value={totals.patients} />
            <SummaryMetric label="On Rent" value={totals.onRent} />
          </div>
        </section>

        <section className={glass.panel}>
          <div className="p-4 sm:p-6">
            {authLoading || loading ? (
              <InventoryLoadingState />
            ) : rentalFacilityTiles.length === 0 ? (
              <InventoryEmptyState />
            ) : (
              <InventoryFacilityRentalTiles
                tiles={rentalFacilityTiles}
                selectedTileId={selectedFacilityTileId}
                onSelect={(tileId) =>
                  setSelectedFacilityTileId((current) =>
                    current === tileId ? "" : tileId
                  )
                }
                onClear={() => setSelectedFacilityTileId("")}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className={glass.insetPadded}>
      <p className={typography.caption}>{label}</p>
      <p className={`mt-1 ${typography.cardTitle}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
