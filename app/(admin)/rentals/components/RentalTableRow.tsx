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
    <tr className="transition hover:bg-white/[0.035]">
      <td className="w-[260px] px-4 py-4 align-top">
        <div className="min-w-0">
          <p className="line-clamp-2 break-words font-semibold leading-5 text-white">
            {record.productName || "Unnamed rental asset"}
          </p>

          <p className="mt-1 break-words text-xs leading-5 text-slate-500">
            SN: {record.serialNumber || "â€”"} Â· Asset: {record.assetTag || "â€”"}
          </p>
        </div>
      </td>

      <td className="w-[220px] px-4 py-4 align-top">
        <div className="min-w-0">
          <p className="line-clamp-2 break-words text-sm leading-5 text-slate-200">
            {record.patientName || "â€”"}
          </p>

          <p className="mt-1 break-words text-xs leading-5 text-slate-500">
            ID: {record.patientId || "â€”"}
          </p>
        </div>
      </td>

      <td className="w-[140px] px-4 py-4 align-top">
        <span className="inline-flex max-w-full rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
          <span className="truncate">{formatStatus(record.status)}</span>
        </span>
      </td>

      <TableCell value={formatCondition(record.condition)} width="w-[150px]" />

      <td className="w-[180px] px-4 py-4 align-top text-sm text-slate-300">
        <div className="min-w-0 break-words leading-5">
          {record.location || "â€”"}
        </div>
      </td>

      <td className="w-[210px] px-4 py-4 align-top text-sm text-slate-300">
        <div className="min-w-0 space-y-1 leading-5">
          <p className="break-words">Out: {formatDate(record.checkedOutDate)}</p>
          <p className="break-words">Due: {formatDate(record.expectedReturnDate)}</p>
          <p className="break-words">Back: {formatDate(record.returnedDate)}</p>
        </div>
      </td>

      <td className="w-[120px] px-4 py-4 align-top text-sm font-semibold text-white">
        <div className="min-w-0 break-words">
          {formatCurrency(record.monthlyRate)}
        </div>
      </td>

      <td className="w-[260px] px-4 py-4 align-top">
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

function TableCell({
  value,
  width,
}: {
  value: string;
  width: string;
}) {
  return (
    <td className={`${width} px-4 py-4 align-top text-sm text-slate-300`}>
      <div className="min-w-0 break-words leading-5">{value || "â€”"}</div>
    </td>
  );
}


