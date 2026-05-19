"use client";

import type { Rental } from "../types/rentalTypes";
import { money } from "../utils/rentalCalculations";
import { statusClass } from "../utils/rentalStyles";
import { RentalActions } from "./RentalActions";

type RentalMobileCardProps = {
  rental: Rental;
  onEdit: (rental: Rental) => void;
  onReturn: (rental: Rental) => void;
  onArchive: (rental: Rental) => void;
};

export function RentalMobileCard({
  rental,
  onEdit,
  onReturn,
  onArchive,
}: RentalMobileCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{rental.productName}</h3>
          <p className="text-xs text-slate-500">
            {rental.category || "No category"}
            {rental.sku ? ` • ${rental.sku}` : ""}
          </p>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
            rental.status
          )}`}
        >
          {rental.status}
        </span>
      </div>

      <div className="grid gap-2 text-sm text-slate-300">
        <p>Customer: {rental.customerName || "-"}</p>
        <p>Patient: {rental.patientName || "-"}</p>
        <p>Serial: {rental.serialNumber || "-"}</p>
        <p>
          Dates: {rental.rentalStartDate || "-"} to{" "}
          {rental.rentalEndDate || "Active"}
        </p>
        <p>
          Total:{" "}
          <span className="font-semibold text-white">
            {money(rental.totalCharges)}
          </span>
        </p>
        <p>Delivery: {rental.deliveryStatus}</p>
      </div>

      <div className="mt-4">
        <RentalActions
          rental={rental}
          onEdit={onEdit}
          onReturn={onReturn}
          onArchive={onArchive}
        />
      </div>
    </article>
  );
}