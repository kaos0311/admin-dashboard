"use client";

import {
  Loader2,
  Package2,
  RefreshCcw,
  Trash2,
} from "lucide-react";

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
    <section className="rounded-[32px] border border-white/10 bg-white/[0.07] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-3xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.08] p-4 shadow-inner shadow-white/5">
            <Package2 className="h-7 w-7 text-sky-100" />
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Products
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Master DME/HME catalog for inventory, rentals, serialized tracking,
              billing references, recalls, and operational accountability.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loadingProducts}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingProducts ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}

            Refresh
          </button>

          <button
            type="button"
            onClick={onPurge}
            disabled={!isAdmin || purging || productsCount === 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {purging ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}

            Purge Loaded
          </button>
        </div>
      </div>
    </section>
  );
}