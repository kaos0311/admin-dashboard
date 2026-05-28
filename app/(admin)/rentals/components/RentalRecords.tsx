import type { Dispatch, SetStateAction } from "react";
import { Loader2, Search } from "lucide-react";
import { RENTAL_STATUSES } from "../rentals-constants";
import type {
  RentalFilters,
  RentalRecord,
  RentalStatus,
} from "../rentals-types";
import { RentalMobileCard } from "./RentalMobileCard";
import { RentalTableRow } from "./RentalTableRow";
import { EmptyState } from "./shared/EmptyState";
import { GlassCard } from "./shared/GlassCard";
import { SectionHeader } from "./shared/SectionHeader";

type RentalRecordsProps = {
  records: RentalRecord[];
  loading: boolean;
  filters: RentalFilters;
  setFilters: Dispatch<SetStateAction<RentalFilters>>;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onEdit: (record: RentalRecord) => void;
  onDelete: (recordId: string) => Promise<void>;
  onMarkReturned: (recordId: string) => Promise<void>;
};

export function RentalRecords({
  records,
  loading,
  filters,
  setFilters,
  hasActiveFilters,
  onClearFilters,
  onEdit,
  onDelete,
  onMarkReturned,
}: RentalRecordsProps) {
  return (
    <GlassCard>
      <SectionHeader
        eyebrow="Live records"
        title="Rental Inventory Records"
        description="Search, filter, return, edit, or delete rental records. Try not to delete production evidence unless you enjoy audit pain."
      />

      <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_220px_auto]">
        <label className="relative block" htmlFor="rental-search">
          <span className="sr-only">Search rentals</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

          <input
            id="rental-search"
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            placeholder="Search product, serial, asset tag, patient, location..."
            className="h-11 w-full rounded-2xl border border-white/10 bg-black/30 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:bg-black/40 focus:ring-4 focus:ring-cyan-400/10"
          />
        </label>

        <label className="block" htmlFor="rental-status-filter">
          <span className="sr-only">Filter rental status</span>

          <select
            id="rental-status-filter"
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value as "all" | RentalStatus,
              }))
            }
            aria-label="Filter rental status"
            className="h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:bg-black/40 focus:ring-4 focus:ring-cyan-400/10"
          >
            <option value="all" className="bg-slate-950">
              All statuses
            </option>

            {RENTAL_STATUSES.map((status) => (
              <option
                key={status.value}
                value={status.value}
                className="bg-slate-950"
              >
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onClearFilters}
          disabled={!hasActiveFilters}
          className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center rounded-3xl border border-white/10 bg-black/20">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-200" />
              Loading rentals...
            </div>
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            title="No rental records found"
            description={
              hasActiveFilters
                ? "No rental assets match the current filters. Clear them before blaming the database like everyone else does."
                : "No rental assets have been created yet. Add one above to begin tracking equipment."
            }
            action={
              hasActiveFilters ? (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
                >
                  Clear Filters
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-3xl border border-white/10 lg:block">
              <table className="w-full border-collapse text-left">
                <thead className="bg-white/[0.045] text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Asset</th>
                    <th className="px-4 py-3 font-semibold">Patient</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Condition</th>
                    <th className="px-4 py-3 font-semibold">Location</th>
                    <th className="px-4 py-3 font-semibold">Dates</th>
                    <th className="px-4 py-3 font-semibold">Rate</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {records.map((record) => (
                    <RentalTableRow
                      key={record.id}
                      record={record}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onMarkReturned={onMarkReturned}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 lg:hidden">
              {records.map((record) => (
                <RentalMobileCard
                  key={record.id}
                  record={record}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMarkReturned={onMarkReturned}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </GlassCard>
  );
}
