import { CheckCircle2, Pencil, Trash2 } from "lucide-react";
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
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onEdit(record)}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.09]"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </button>

      {record.status === "checked_out" || record.status === "overdue" ? (
        <button
          type="button"
          onClick={() => onMarkReturned(record.id)}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/15"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Return
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => {
          const confirmed = window.confirm(
            "Delete this rental record? This removes the asset tracking row. Humanity already deletes enough useful things, so make sure."
          );

          if (confirmed) void onDelete(record.id);
        }}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-red-300/20 bg-red-500/10 px-3 text-xs font-semibold text-red-100 transition hover:bg-red-500/15"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
    </div>
  );
}