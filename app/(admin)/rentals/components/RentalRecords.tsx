import type { Dispatch, SetStateAction } from "react";
import { Loader2, Search } from "lucide-react";

import { buttons, forms, glass, tables, typography } from "@/theme";

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
    <GlassCard className="min-w-0">
      <SectionHeader
        eyebrow="Live records"
        title="Rental Inventory Records"
        description="Search, filter, return, edit, or delete rental records. Keep the asset trail clean unless you enjoy audit pain."
      />

      <div className="mt-6 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
        <label className="relative block min-w-0" htmlFor="rental-search">
          <span className="sr-only">Search rentals</span>

          <Search
            className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${typography.smallMuted}`}
            aria-hidden="true"
          />

          <input
            id="rental-search"
            name="rental-search"
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            placeholder="Search product, serial, asset tag, patient, location..."
            aria-label="Search rentals"
            className={`${forms.input} pl-11`}
          />
        </label>

        <label className="block min-w-0" htmlFor="rental-status-filter">
          <span className="sr-only">Filter rental status</span>

          <select
            id="rental-status-filter"
            name="rental-status-filter"
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value as "all" | RentalStatus,
              }))
            }
            aria-label="Filter rental status"
            className={forms.select}
          >
            <option value="all">
              All statuses
            </option>

            {RENTAL_STATUSES.map((status) => (
              <option
                key={status.value}
                value={status.value}
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
          aria-label="Clear rental filters"
          className={buttons.secondary}
        >
          Clear
        </button>
      </div>

      <div className="mt-6 min-w-0">
        {loading ? (
          <div className={`${glass.card} flex min-h-[220px] items-center justify-center`}>
            <div className={`flex min-w-0 items-center gap-3 ${typography.bodyMuted}`}>
              <Loader2
                className="h-5 w-5 shrink-0 animate-spin"
                aria-hidden="true"
              />
              <span>Loading rentals...</span>
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
                  className={buttons.primary}
                >
                  Clear Filters
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className={`hidden lg:block ${tables.wrapper}`}>
              <div className={tables.scroll}>
                <table className={`${tables.table} min-w-[1200px] border-collapse`}>
                  <thead className={tables.head}>
                    <tr>
                      <th className={tables.headCell}>Asset</th>
                      <th className={tables.headCell}>Patient</th>
                      <th className={tables.headCell}>Status</th>
                      <th className={tables.headCell}>Condition</th>
                      <th className={tables.headCell}>Location</th>
                      <th className={tables.headCell}>Dates</th>
                      <th className={tables.headCell}>Rate</th>
                      <th className={tables.headCell}>Actions</th>
                    </tr>
                  </thead>

                  <tbody className={tables.body}>
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
            </div>

            <div className="grid min-w-0 gap-4 lg:hidden">
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

