import { tiles, typography } from "@/theme";

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
          <p className={`${typography.cardTitle} line-clamp-2 leading-5`}>
            {record.productName || "Unnamed rental asset"}
          </p>

          <p className={`${typography.smallMuted} mt-1 break-words leading-5`}>
            SN: {record.serialNumber || "—"} · Asset: {record.assetTag || "—"}
          </p>
        </div>
      </td>

      <td className="w-[220px] px-4 py-4 align-top">
        <div className="min-w-0">
          <p className={`${typography.body} line-clamp-2 leading-5`}>
            {record.patientName || "—"}
          </p>

          <p className={`${typography.smallMuted} mt-1 break-words leading-5`}>
            ID: {record.patientId || "—"}
          </p>
        </div>
      </td>

      <td className="w-[140px] px-4 py-4 align-top">
        <span className={tiles.badge}>
          <span className="truncate">
            {formatStatus(record.status)}
          </span>
        </span>
      </td>

      <TableCell
        value={formatCondition(record.condition)}
        width="w-[150px]"
      />

      <td className={`w-[180px] px-4 py-4 align-top ${typography.bodyMuted}`}>
        <div className="min-w-0 break-words leading-5">
          {record.location || "—"}
        </div>
      </td>

      <td className={`w-[210px] px-4 py-4 align-top ${typography.bodyMuted}`}>
        <div className="min-w-0 space-y-1 leading-5">
          <p className="break-words">
            Out: {formatDate(record.checkedOutDate)}
          </p>

          <p className="break-words">
            Due: {formatDate(record.expectedReturnDate)}
          </p>

          <p className="break-words">
            Back: {formatDate(record.returnedDate)}
          </p>
        </div>
      </td>

      <td className="w-[120px] px-4 py-4 align-top">
        <div className={`${typography.cardTitle} min-w-0 break-words`}>
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
    <td className={`${width} px-4 py-4 align-top ${typography.bodyMuted}`}>
      <div className="min-w-0 break-words leading-5">
        {value || "—"}
      </div>
    </td>
  );
}

