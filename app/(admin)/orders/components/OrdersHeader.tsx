"use client";

import { Plus, RefreshCcw, Search, Sparkles } from "lucide-react";

import { glassButton, glassInput, primaryButton, smallMutedText } from "../lib/orderUi";

export function OrdersHeader({
  loadedCount,
  search,
  refreshing,
  onSearchChange,
  onRefresh,
  onCreate,
}: {
  loadedCount: number;
  search: string;
  refreshing: boolean;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200 shadow-lg shadow-cyan-950/20 backdrop-blur-xl">
          <Sparkles className="h-3.5 w-3.5" aria-hidden={true} />
          Smart Intake Enabled
        </div>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
          Orders
        </h1>

        <p className="mt-1 max-w-3xl text-sm text-zinc-400">
          Track patient orders, imported report orders, inventory allocation,
          review flags, and delivery progress without turning production into a
          clipboard hostage situation.
        </p>

        <p className={`mt-1 ${smallMutedText}`}>
          Showing {loadedCount.toLocaleString()} loaded order
          {loadedCount === 1 ? "" : "s"} for the selected tab.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <label className="relative w-full max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden={true}
          />
          <span className="sr-only">Search orders</span>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search patient, product, sales order, phone..."
            className={`${glassInput} pl-10`}
          />
        </label>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className={glassButton}
        >
          <RefreshCcw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            aria-hidden={true}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>

        <button type="button" onClick={onCreate} className={primaryButton}>
          <Plus className="h-4 w-4" aria-hidden={true} />
          Create Order
        </button>
      </div>
    </div>
  );
}