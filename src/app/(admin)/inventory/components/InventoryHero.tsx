"use client";

import { ScanLine, ShieldCheck } from "lucide-react";

import { buttons, colors, glass, tiles, typography } from "@/theme";

import type { ScanTarget } from "../lib/inventoryTypes";

type InventoryHeroProps = {
  canWrite: boolean;
  onOpenScanner: (target: ScanTarget) => void;
};

export function InventoryHero({ canWrite, onOpenScanner }: InventoryHeroProps) {
  return (
    <section className={`${glass.panelPadded} p-5 sm:p-6`}>
      <div className={colors.grid} />

      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div className={tiles.label}>
            <ShieldCheck className="h-3.5 w-3.5" />

            Inventory Intelligence
          </div>

          <h1 className={typography.pageTitle}>
            Inventory Command Center
          </h1>

          <p className={`${typography.bodyMuted} mt-2 max-w-2xl`}>
            Operational inventory management for lifecycle tracking, warranty
            monitoring, service alerts, batch actions, barcode intake,
            discontinuation, and stock oversight.
          </p>
        </div>

        <div className={`${glass.insetPadded} max-w-sm`}>
          <div className="flex items-center gap-4">
            <div className={tiles.compact}>
              <ScanLine className="h-6 w-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <p className={typography.cardTitle}>
                  Inventory Scanner
                </p>

                <span className={tiles.label}>
                  <span className={`h-2 w-2 animate-pulse rounded-full ${colors.pulse}`} />

                  Online
                </span>
              </div>

              <p className={typography.caption}>
                Camera, handheld, or manual scan intake.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onOpenScanner("scanIn")}
              className={buttons.success}
              disabled={!canWrite}
            >
              <ScanLine className="h-4 w-4" />
              Scan In
            </button>

            <button
              type="button"
              onClick={() => onOpenScanner("scanOut")}
              className={buttons.warning}
              disabled={!canWrite}
            >
              <ScanLine className="h-4 w-4" />
              Scan Out
            </button>
          </div>

          <div className={`${glass.inset} mt-3 px-3 py-2 ${typography.caption}`}>
            Writes to inventory and stock movements when a matching record is found.
          </div>
        </div>
      </div>
    </section>
  );
}
