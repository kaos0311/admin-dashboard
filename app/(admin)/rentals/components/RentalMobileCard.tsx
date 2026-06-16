import { glass, typography } from "@/theme";

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
    <article className={glass.cardPadded}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold leading-5 text-white">
            {record.productName || "Unnamed rental asset"}
          </h3>

          <p className={`mt-1 break-words text-xs leading-5 ${typography.caption}`}>
            SN: {record.serialNumber || "-"} | Asset: {record.assetTag || "-"}
          </p>

          <p className={`mt-1 break-words text-xs leading-5 ${typography.caption}`}>
            {record.procCode || record.itemId || "No HCPCS"} |{" "}
            {record.itemGroup || "No group"}
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
          {formatStatus(record.status)}
        </span>
      </div>

      <div className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
        <RentalInfoBlock
          label="Patient"
          primary={record.patientName || "-"}
          secondary={`${record.patientId || "-"} | DOB ${formatDate(record.patientDob)}`}
        />

        <RentalInfoBlock
          label="Payor"
          primary={record.insuranceName || record.payor || "-"}
          secondary={record.planType || undefined}
        />

        <RentalInfoBlock
          label="PAR"
          primary={record.parNumber || "-"}
          secondary={`Exp ${formatDate(record.parExpiration)}`}
        />

        <RentalInfoBlock
          label="Condition"
          primary={formatCondition(record.condition)}
        />

        <RentalInfoBlock
          label="Allowable"
          primary={formatCurrency(record.monthlyRate)}
          secondary={`Charge ${formatCurrency(record.extCharge || record.charge)}`}
          strong
        />

        <RentalInfoBlock
          label="Doctor"
          primary={record.orderingDoctor || record.primaryDoctor || "-"}
        />

        <RentalInfoBlock
          label="Checked Out"
          primary={formatDate(record.checkedOutDate)}
        />

        <RentalInfoBlock
          label="Next Billing"
          primary={formatDate(record.nextBillingDate || record.expectedReturnDate)}
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
      <p className={`truncate text-xs uppercase tracking-[0.16em] ${typography.caption}`}>
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
        <p className={`min-w-0 break-words text-xs ${typography.caption}`}>
          {secondary}
        </p>
      ) : null}
    </div>
  );
}
