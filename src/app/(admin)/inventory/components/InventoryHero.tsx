"use client";

import { ScanLine, ShieldCheck } from "lucide-react";

import { buttons, glass, colors, tiles, typography } from "@/theme";

import type { ScanTarget } from "../lib/inventoryTypes";

type InventoryHeroProps = {
  canWrite: boolean;
  onOpenScanner: (target: ScanTarget) => void;
};

export function InventoryHero({ canWrite, onOpenScanner }: InventoryHeroProps) {
  return (
    <section className={`${glass.panel} p-5 sm:p-6`}>
      <div className={colors.grid} />

      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-4">
          <div className={tiles.label}>
            <ShieldCheck className="h-3.5 w-3.5" />

            Inventory Intelligence
          </div>

          <div>
            <h1 className={typography.pageTitle}>
              Inventory Command
              Center
            </h1>

            <p className={`mt-3 max-w-3xl ${typography.body}`}>
              Operational inventory
              management for
              lifecycle tracking,
              warranty monitoring,
              service due alerts,
              batch actions,
              barcode intake,
              discontinuation, and
              stock oversight.
              Because eventually
              someone loses a serial
              number and pretends it
              was never there.
            </p>
          </div>
        </div>

        <div className={`${glass.card} max-w-sm p-4 sm:p-5`}>
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
                  <span className="h-2 w-2 animate-pulse rounded-full bg-sky-200 shadow-[0_0_10px_rgba(186,230,253,0.9)]" />

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
