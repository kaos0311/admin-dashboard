import type { RentalRecord } from "../rentals-types";
import {
  formatCondition,
  formatCurrency,
  formatDate,
  formatStatus,
} from "../utils/formatters";
import { RentalActions } from "./RentalActions";

type RentalTableRowProps = {
  record: RentalRecord;
  onEdit: (record: RentalRecord) => void;
  onDelete: (recordId: string) => Promise<void>;
  onMarkReturned: (recordId: string) => Promise<void>;
};

export function RentalTableRow({
  record,
  onEdit,
  onDelete,
  onMarkReturned,
}: RentalTableRowProps) {
  return (
    <tr className="border-b border-white/10 transition hover:bg-white/[0.035]">
      <td className="px-4 py-4 align-top">
        <div>
          <p className="font-semibold text-white">{record.productName}</p>
          <p className="mt-1 text-xs text-slate-500">
            SN: {record.serialNumber || "—"} · Asset: {record.assetTag || "—"}
          </p>
        </div>
      </td>

      <td className="px-4 py-4 align-top">
        <p className="text-sm text-slate-200">{record.patientName || "—"}</p>
        <p className="mt-1 text-xs text-slate-500">
          ID: {record.patientId || "—"}
        </p>
      </td>

      <td className="px-4 py-4 align-top">
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
          {formatStatus(record.status)}
        </span>
      </td>

      <td className="px-4 py-4 align-top text-sm text-slate-300">
        {formatCondition(record.condition)}
      </td>

      <td className="px-4 py-4 align-top text-sm text-slate-300">
        {record.location || "—"}
      </td>

      <td className="px-4 py-4 align-top text-sm text-slate-300">
        <div className="space-y-1">
          <p>Out: {formatDate(record.checkedOutDate)}</p>
          <p>Due: {formatDate(record.expectedReturnDate)}</p>
          <p>Back: {formatDate(record.returnedDate)}</p>
        </div>
      </td>

      <td className="px-4 py-4 align-top text-sm font-semibold text-white">
        {formatCurrency(record.monthlyRate)}
      </td>

      <td className="px-4 py-4 align-top">
        <RentalActions
          record={record}
          onEdit={onEdit}
          onDelete={onDelete}
          onMarkReturned={onMarkReturned}
        />
      </td>
    </tr>
  );
}
