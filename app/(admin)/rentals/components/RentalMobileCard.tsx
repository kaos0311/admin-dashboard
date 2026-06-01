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
    <article className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold leading-5 text-white">
            {record.productName || "Unnamed rental asset"}
          </h3>

          <p className="mt-1 break-words text-xs leading-5 text-slate-500">
            SN: {record.serialNumber || "â€”"} Â· Asset: {record.assetTag || "â€”"}
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
          {formatStatus(record.status)}
        </span>
      </div>

      <div className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
        <RentalInfoBlock
          label="Patient"
          primary={record.patientName || "â€”"}
          secondary={record.patientId || "â€”"}
        />

        <RentalInfoBlock
          label="Location"
          primary={record.location || "â€”"}
        />

        <RentalInfoBlock
          label="Condition"
          primary={formatCondition(record.condition)}
        />

        <RentalInfoBlock
          label="Monthly"
          primary={formatCurrency(record.monthlyRate)}
          strong
        />

        <RentalInfoBlock
          label="Checked Out"
          primary={formatDate(record.checkedOutDate)}
        />

        <RentalInfoBlock
          label="Expected Return"
          primary={formatDate(record.expectedReturnDate)}
        />
      </div>

      {record.notes ? (
        <p className="mt-4 min-w-0 break-words rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-slate-300">
          {record.notes}
        </p>
      ) : null}

      <div className="mt-4 min-w-0">
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

function RentalInfoBlock({
  label,
  primary,
  secondary,
  strong = false,
}: {
  label: string;
  primary: string;
  secondary?: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>

      <p
        className={[
          "mt-1 min-w-0 break-words",
          strong ? "font-semibold text-white" : "text-slate-200",
        ].join(" ")}
      >
        {primary}
      </p>

      {secondary ? (
        <p className="min-w-0 break-words text-xs text-slate-500">
          {secondary}
        </p>
      ) : null}
    </div>
  );
}


