import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";

import { buttons } from "@/theme";

import type { RentalRecord } from "../rentals-types";

type RentalActionsProps = {
  record: RentalRecord;
  onEdit: (record: RentalRecord) => void;
  onDelete: (recordId: string) => Promise<void>;
  onMarkReturned: (recordId: string) => Promise<void>;
};

export function RentalActions({
  record,
  onEdit,
  onDelete,
  onMarkReturned,
}: RentalActionsProps) {
  const [busy, setBusy] = useState(false);

  async function handleReturn() {
    try {
      setBusy(true);
      await onMarkReturned(record.id);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Delete this rental record? This removes the asset tracking row. Make sure you're deleting the correct record."
    );

    if (!confirmed) return;

    try {
      setBusy(true);
      await onDelete(record.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onEdit(record)}
        disabled={busy}
        aria-label={`Edit rental ${record.id}`}
        className={buttons.compactSecondary}
      >
        <Pencil
          className="h-3.5 w-3.5 shrink-0"
          aria-hidden="true"
        />
        <span>Edit</span>
      </button>

      {(record.status === "checked_out" ||
        record.status === "overdue") && (
        <button
          type="button"
          onClick={handleReturn}
          disabled={busy}
          aria-label={`Mark rental ${record.id} returned`}
          className={buttons.compactSuccess}
        >
          {busy ? (
            <Loader2
              className="h-3.5 w-3.5 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <CheckCircle2
              className="h-3.5 w-3.5"
              aria-hidden="true"
            />
          )}

          <span>Return</span>
        </button>
      )}

      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        aria-label={`Delete rental ${record.id}`}
        className={buttons.compactDanger}
      >
        {busy ? (
          <Loader2
            className="h-3.5 w-3.5 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <Trash2
            className="h-3.5 w-3.5"
            aria-hidden="true"
          />
        )}

        <span>Delete</span>
      </button>
    </div>
  );
}



