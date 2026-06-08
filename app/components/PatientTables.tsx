"use client";

import type {
  CurrentEquipmentItem,
  RecentPurchaseItem,
} from "../(admin)/reports/patients/lib/patientTypes";
import {
  formatDate,
  formatMoney,
} from "../(admin)/reports/patients/lib/patientUtils";

import { tables, typography } from "@/theme";

const EMPTY_DASH = "—";

export function EquipmentTable({ items }: { items: CurrentEquipmentItem[] }) {
  if (!items.length) {
    return (
      <p className={tables.empty}>
        No current equipment indexed for this patient.
      </p>
    );
  }

  return (
    <div className={tables.wrapper}>
      <div className={tables.scroll}>
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className={tables.head}>
            <tr>
              <th className={compactHeaderCell()}>Item</th>
              <th className={compactHeaderCell()}>HCPC</th>
              <th className={compactHeaderCell()}>Type</th>
              <th className={compactHeaderCell()}>Qty</th>
              <th className={compactHeaderCell()}>Status</th>
              <th className={compactHeaderCell()}>Serial</th>
              <th className={compactHeaderCell()}>Lot</th>
              <th className={compactHeaderCell()}>Start</th>
              <th className={compactHeaderCell()}>Maint.</th>
              <th className={compactHeaderCell()}>Replace Due</th>
            </tr>
          </thead>

          <tbody className={tables.body}>
            {items.slice(0, 25).map((item, index) => (
              <tr
                key={`${item.itemName}-${item.serialNumber}-${index}`}
                className={tables.row}
              >
                <td className={compactStrongCell()}>
                  {item.itemName || EMPTY_DASH}
                </td>

                <td className={compactMutedCell()}>
                  {item.hcpc || item.itemId || EMPTY_DASH}
                </td>

                <td className={compactMutedCell()}>
                  {item.saleType || EMPTY_DASH}
                </td>

                <td className={compactMutedCell()}>
                  {item.qty ?? EMPTY_DASH}
                </td>

                <td className={compactMutedCell()}>
                  {item.status || EMPTY_DASH}
                </td>

                <td className={compactMutedCell()}>
                  {item.serialNumber || EMPTY_DASH}
                </td>

                <td className={compactMutedCell()}>
                  {item.lotNumber || EMPTY_DASH}
                </td>

                <td className={compactMutedCell()}>
                  {formatDate(item.startDate)}
                </td>

                <td className={compactMutedCell()}>
                  {item.maintenanceStatus || EMPTY_DASH}
                </td>

                <td className={compactMutedCell()}>
                  {formatDate(item.replacementDueDate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PurchaseTable({ items }: { items: RecentPurchaseItem[] }) {
  if (!items.length) {
    return (
      <p className={tables.empty}>
        No purchases indexed in the last 90 days.
      </p>
    );
  }

  return (
    <div className={tables.wrapper}>
      <div className={tables.scroll}>
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className={tables.head}>
            <tr>
              <th className={compactHeaderCell()}>Item</th>
              <th className={compactHeaderCell()}>HCPC</th>
              <th className={compactHeaderCell()}>Date</th>
              <th className={compactHeaderCell()}>Qty</th>
              <th className={compactHeaderCell()}>Amount</th>
              <th className={compactHeaderCell()}>Order</th>
            </tr>
          </thead>

          <tbody className={tables.body}>
            {items.slice(0, 25).map((item, index) => (
              <tr
                key={`${item.itemName}-${item.orderId}-${index}`}
                className={tables.row}
              >
                <td className={compactStrongCell()}>
                  {item.itemName || EMPTY_DASH}
                </td>

                <td className={compactMutedCell()}>
                  {item.hcpc || item.itemId || EMPTY_DASH}
                </td>

                <td className={compactMutedCell()}>
                  {formatDate(item.purchaseDate)}
                </td>

                <td className={compactMutedCell()}>
                  {item.quantity ?? EMPTY_DASH}
                </td>

                <td className={compactMutedCell()}>
                  {formatMoney(item.amount)}
                </td>

                <td className={compactMutedCell()}>
                  {item.orderId || EMPTY_DASH}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function compactHeaderCell(): string {
  return "px-3 py-2";
}

function compactStrongCell(): string {
  return ["px-3 py-2", typography.bodyStrong].join(" ");
}

function compactMutedCell(): string {
  return ["px-3 py-2", typography.bodyMuted].join(" ");
}

