"use client";

import type { Rental } from "../types/rentalTypes";
import { money } from "../utils/rentalCalculations";
import { statusClass } from "../utils/rentalStyles";
import { RentalActions } from "./RentalActions";

type RentalTableRowProps = {
  rental: Rental;
  onEdit: (rental: Rental) => void;
  onReturn: (rental: Rental) => void;
  onArchive: (rental: Rental) => void;
};

export function RentalTableRow({
  rental,
  onEdit,
  onReturn,
  onArchive,
}: RentalTableRowProps) {
  return (
    <tr className="border-t border-white/10 align-top transition hover:bg-white/[0.04]">
      <td className="px-4 py-3">
        <div className="font-semibold text-white">{rental.productName}</div>
        <div className="text-xs text-slate-500">
          {rental.category || "No category"}
          {rental.sku ? ` • ${rental.sku}` : ""}
        </div>
        <div className="text-xs text-slate-500">
          SN: {rental.serialNumber || "-"} • Lot: {rental.lotNumber || "-"}
        </div>
      </td>

      <td className="px-4 py-3 text-slate-300">
        <div>{rental.customerName || "-"}</div>
        <div className="text-xs text-slate-500">
          Patient: {rental.patientName || "-"}
        </div>
        <div className="text-xs text-slate-500">
          ID: {rental.patientId || "-"}
        </div>
      </td>

      <td className="px-4 py-3 text-slate-300">
        <div>{rental.payerName || "-"}</div>
        <div className="text-xs text-slate-500">
          {rental.insuranceType || "No insurance type"}
        </div>
        <div className="text-xs text-slate-500">
          Auth: {rental.authorizationNumber || "-"}
        </div>
      </td>

      <td className="px-4 py-3 text-slate-300">
        <div>Start: {rental.rentalStartDate || "-"}</div>
        <div>End: {rental.rentalEndDate || "Active"}</div>
      </td>

      <td className="px-4 py-3 text-right text-slate-300">
        {rental.monthsUsed.toLocaleString()}
      </td>

      <td className="px-4 py-3 text-right">
        <div className="font-semibold text-white">{money(rental.totalCharges)}</div>
        <div className="text-xs text-slate-500">
          {money(rental.monthlyRate)} / {rental.billingCycle}
        </div>
      </td>

      <td className="px-4 py-3">
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
            rental.status
          )}`}
        >
          {rental.status}
        </span>
      </td>

      <td className="px-4 py-3 text-slate-300">
        <div>{rental.deliveryStatus}</div>
        <div className="text-xs text-slate-500">
          Delivery: {rental.deliveryDate || "-"}
        </div>
        <div className="text-xs text-slate-500">
          Pickup: {rental.pickupDate || "-"}
        </div>
      </td>

      <td className="px-4 py-3">
        <RentalActions
          rental={rental}
          onEdit={onEdit}
          onReturn={onReturn}
          onArchive={onArchive}
        />
      </td>
    </tr>
  );
}