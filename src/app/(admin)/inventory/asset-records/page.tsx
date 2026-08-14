"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { ArrowLeft, PackageCheck, RefreshCcw } from "lucide-react";

import { buttons, colors, glass, tiles, typography } from "@/theme";

import { useAuthRole } from "@/app/hooks/useAuthRole";
import { hasPermission } from "@/lib/permissions/roles";

import { InventoryAssetTiles } from "../components/InventoryAssetTiles";
import { InventoryEmptyState } from "../components/InventoryEmptyState";
import { InventoryLoadingState } from "../components/InventoryLoadingState";
import { useInventoryData } from "../hooks/useInventoryData";
import { isActiveAssetRecord } from "../lib/assetRecords";

export default function InventoryAssetRecordsPage() {
  const {
    loading: authLoading,
    role,
    canAccessCommandCenter,
  } = useAuthRole();

  const canRead =
    canAccessCommandCenter &&
    hasPermission(role, "inventory:read");

  const [refreshKey, setRefreshKey] = useState(0);

  const {
    items,
    loading,
    lastLoadedAt,
  } = useInventoryData({
    authLoading,
    canRead,
    refreshKey,
  });

  const assetItems = useMemo(
    () => items.filter(isActiveAssetRecord),
    [items]
  );

  const totals = useMemo(
    () =>
      assetItems.reduce(
        (summary, item) => ({
          assets: summary.assets + 1,
          onRent: summary.onRent + item.onRent,
          available: summary.available + item.available,
        }),
        { assets: 0, onRent: 0, available: 0 }
      ),
    [assetItems]
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
                  <PackageCheck className="h-6 w-6" aria-hidden="true" />
                </span>

                <div className="min-w-0">
                  <p className={tiles.label}>Inventory asset records</p>
                  <h1 className="mt-2 break-words text-3xl font-bold tracking-tight">
                    Asset Records
                  </h1>
                  <p className={`${typography.bodyMuted} mt-2 max-w-3xl`}>
                    Asset title groups, patient links, serial tracking, HCPCS,
                    and callable asset detail records from the inventory
                    pipeline.
                  </p>
                  <p className={`mt-2 text-xs ${typography.caption}`}>
                    {lastLoadedAt
                      ? `Last synced: ${lastLoadedAt.toLocaleTimeString()}`
                      : "Waiting for asset record sync..."}
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
            <SummaryMetric label="Asset Records" value={totals.assets} />
            <SummaryMetric label="On Rent" value={totals.onRent} />
            <SummaryMetric label="Available" value={totals.available} />
          </div>
        </section>

        <section className={glass.panel}>
          <div className="p-4 sm:p-6">
            {authLoading || loading ? (
              <InventoryLoadingState />
            ) : assetItems.length === 0 ? (
              <InventoryEmptyState />
            ) : (
              <InventoryAssetTiles items={assetItems} />
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
