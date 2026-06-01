"use client";

import { Loader2, Package2, RefreshCcw, Trash2 } from "lucide-react";

type ProductHeroProps = {
  loadingProducts: boolean;
  purging: boolean;
  productsCount: number;
  isAdmin: boolean;
  onRefresh: () => void;
  onPurge: () => void;
};

export function ProductHero({
  loadingProducts,
  purging,
  productsCount,
  isAdmin,
  onRefresh,
  onPurge,
}: ProductHeroProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.07] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-3xl sm:p-6">
      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="shrink-0 rounded-3xl border border-white/10 bg-white/[0.08] p-4 shadow-inner shadow-white/5">
            <Package2 className="h-7 w-7 text-sky-100" />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold tracking-tight text-white">
              Products
            </h1>

            <p className="mt-1 max-w-4xl text-pretty text-sm leading-6 text-slate-400">
              Master DME/HME catalog for inventory, rentals, serialized
              tracking, billing references, recalls, and operational
              accountability.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3 lg:justify-end">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loadingProducts}
            aria-label="Refresh products"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-white/[0.14] focus:outline-none focus:ring-2 focus:ring-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingProducts ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4 shrink-0" />
            )}

            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={onPurge}
            disabled={!isAdmin || purging || productsCount === 0}
            aria-label="Purge loaded products"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-3 text-sm font-semibold text-red-200 shadow-lg shadow-black/20 transition hover:bg-red-400/20 focus:outline-none focus:ring-2 focus:ring-red-300/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {purging ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 shrink-0" />
            )}

            <span>Purge Loaded</span>
          </button>
        </div>
      </div>
    </section>
  );
}


