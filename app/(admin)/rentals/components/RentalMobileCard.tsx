import type { RentalRecord } from "../rentals-types";
import {
  formatCondition,
  formatCurrency,
  formatDate,
  formatStatus,
} from "../utils/formatters";
import { RentalActions } from "./RentalActions";

type RentalMobileCardProps = {
  record: RentalRecord;
  onEdit: (record: RentalRecord) => void;
  onDelete: (recordId: string) => Promise<void>;
  onMarkReturned: (recordId: string) => Promise<void>;
};

export function RentalMobileCard({
  record,
  onEdit,
  onDelete,
  onMarkReturned,
}: RentalMobileCardProps) {
  return (
    <article className="rounded-3xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{record.productName}</h3>
          <p className="mt-1 text-xs text-slate-500">
            SN: {record.serialNumber || "—"} · Asset: {record.assetTag || "—"}
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
          {formatStatus(record.status)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Patient
          </p>
          <p className="mt-1 text-slate-200">{record.patientName || "—"}</p>
          <p className="text-xs text-slate-500">{record.patientId || "—"}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Location
          </p>
          <p className="mt-1 text-slate-200">{record.location || "—"}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Condition
          </p>
          <p className="mt-1 text-slate-200">
            {formatCondition(record.condition)}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Monthly
          </p>
          <p className="mt-1 font-semibold text-white">
            {formatCurrency(record.monthlyRate)}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Checked Out
          </p>
          <p className="mt-1 text-slate-200">
            {formatDate(record.checkedOutDate)}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Expected Return
          </p>
          <p className="mt-1 text-slate-200">
            {formatDate(record.expectedReturnDate)}
          </p>
        </div>
      </div>

      {record.notes ? (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-slate-300">
          {record.notes}
        </p>
      ) : null}

      <div className="mt-4">
        <RentalActions
          record={record}
          onEdit={onEdit}
          onDelete={onDelete}
          onMarkReturned={onMarkReturned}
        />
      </div>
    </article>
  );
}