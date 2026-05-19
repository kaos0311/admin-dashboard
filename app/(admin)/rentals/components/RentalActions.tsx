"use client";

import { CheckCircle2, Pencil, XCircle } from "lucide-react";
import type { Rental } from "../types/rentalTypes";

type RentalActionsProps = {
  rental: Rental;
  onEdit: (rental: Rental) => void;
  onReturn: (rental: Rental) => void;
  onArchive: (rental: Rental) => void;
};

export function RentalActions({
  rental,
  onEdit,
  onReturn,
  onArchive,
}: RentalActionsProps) {
  const canReturn = rental.status === "Active" || rental.status === "Past Due";

  return (
    <div className="flex justify-end gap-2">
      {canReturn ? (
        <button
          type="button"
          onClick={() => onReturn(rental)}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
          title={`Return ${rental.productName}`}
          aria-label={`Return ${rental.productName}`}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Return
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => onEdit(rental)}
        className="rounded-xl border border-white/10 bg-white/10 p-2 text-white transition hover:bg-white/15"
        title="Edit rental"
        aria-label={`Edit ${rental.productName}`}
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </button>

      {rental.status !== "Deleted" ? (
        <button
          type="button"
          onClick={() => onArchive(rental)}
          className="rounded-xl border border-red-400/20 bg-red-500/10 p-2 text-red-100 transition hover:bg-red-500/20"
          title="Archive rental"
          aria-label={`Archive ${rental.productName}`}
        >
          <XCircle className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}