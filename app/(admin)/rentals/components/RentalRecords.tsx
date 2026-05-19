"use client";

import { Loader2, Search } from "lucide-react";

import type {
  DeliveryStatus,
  Rental,
  RentalStatus,
} from "../types/rentalTypes";

import { RentalMobileCard } from "./RentalMobileCard";
import { RentalTableRow } from "./RentalTableRow";
import { SelectField } from "../fields/SelectField";

type RentalRecordsProps = {
  rentals: Rental[];
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  statusFilter: "all" | RentalStatus;
  setStatusFilter: (value: "all" | RentalStatus) => void;
  deliveryFilter: "all" | DeliveryStatus;
  setDeliveryFilter: (value: "all" | DeliveryStatus) => void;
  showDeleted: boolean;
  setShowDeleted: (value: boolean) => void;
  onEdit: (rental: Rental) => void;
  onReturn: (rental: Rental) => void;
  onArchive: (rental: Rental) => void;
};

export function RentalRecords({
  rentals,
  loading,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  deliveryFilter,
  setDeliveryFilter,
  showDeleted,
  setShowDeleted,
  onEdit,
  onReturn,
  onArchive,
}: RentalRecordsProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            Rental Records
          </h2>

          <p className="text-sm text-slate-400">
            {rentals.length.toLocaleString()} visible records
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500"
              aria-hidden="true"
            />

            <input
              value={search}
              title="Search rentals"
              aria-label="Search rentals"
              placeholder="Search rentals..."
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/30 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 transition focus:border-white/30 focus:bg-black/40 lg:w-72"
            />
          </div>

          <SelectField
            label="Filter by rental status"
            srOnlyLabel
            value={statusFilter}
            onChange={(value) =>
              setStatusFilter(value as "all" | RentalStatus)
            }
            options={[
              { value: "all", label: "All statuses" },
              { value: "Active", label: "Active" },
              { value: "Returned", label: "Returned" },
              { value: "Past Due", label: "Past Due" },
              { value: "Cancelled", label: "Cancelled" },
              { value: "Deleted", label: "Deleted" },
            ]}
          />

          <SelectField
            label="Filter by delivery status"
            srOnlyLabel
            value={deliveryFilter}
            onChange={(value) =>
              setDeliveryFilter(value as "all" | DeliveryStatus)
            }
            options={[
              { value: "all", label: "All delivery" },
              { value: "Not Scheduled", label: "Not Scheduled" },
              { value: "Scheduled", label: "Scheduled" },
              { value: "Delivered", label: "Delivered" },
              {
                value: "Pickup Scheduled",
                label: "Pickup Scheduled",
              },
              { value: "Picked Up", label: "Picked Up" },
              { value: "Cleaning", label: "Cleaning" },
              { value: "Ready", label: "Ready" },
            ]}
          />
        </div>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={showDeleted}
          title="Show archived rental records"
          aria-label="Show archived rental records"
          onChange={(event) => setShowDeleted(event.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-black"
        />

        Show archived rental records
      </label>

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-4 text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading rentals...
        </div>
      ) : rentals.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-sm text-slate-400">
          No rental records match the current filters.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-white/10 xl:block">
            <table className="w-full min-w-[1450px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-black/60 text-slate-400 backdrop-blur-xl">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Customer / Patient</th>
                  <th className="px-4 py-3">Billing</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3 text-right">Months</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {rentals.map((rental) => (
                  <RentalTableRow
                    key={rental.id}
                    rental={rental}
                    onEdit={onEdit}
                    onReturn={onReturn}
                    onArchive={onArchive}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 xl:hidden">
            {rentals.map((rental) => (
              <RentalMobileCard
                key={rental.id}
                rental={rental}
                onEdit={onEdit}
                onReturn={onReturn}
                onArchive={onArchive}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}