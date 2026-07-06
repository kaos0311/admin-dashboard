import type { RecentPurchaseItem } from "../patient-detail-types";

import { tables } from "@/theme";

import { formatDate, formatMoney } from "../patient-detail-utils";

export function PurchaseTable({
  items,
}: {
  items: RecentPurchaseItem[];
}) {
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
        <table className={`${tables.table} min-w-[700px]`}>
          <thead className={tables.head}>
            <tr>
              <th className={tables.headCell}>Item</th>
              <th className={tables.headCell}>HCPCS</th>
              <th className={tables.headCell}>Date</th>
              <th className={tables.headCell}>Qty</th>
              <th className={tables.headCell}>Amount</th>
              <th className={tables.headCell}>Order</th>
            </tr>
          </thead>

          <tbody className={tables.body}>
            {items.slice(0, 25).map((item, index) => (
              <tr
                key={`${item.itemName}-${item.orderId}-${index}`}
                className={tables.row}
              >
                <td className={tables.cellStrong}>
                  {item.itemName || "—"}
                </td>

                <td className={tables.cell}>
                  {item.hcpc || item.itemId || "—"}
                </td>

                <td className={tables.cell}>
                  {formatDate(item.purchaseDate)}
                </td>

                <td className={tables.cell}>
                  {item.quantity ?? "—"}
                </td>

                <td className={tables.cell}>
                  {formatMoney(item.amount)}
                </td>

                <td className={tables.cell}>
                  {item.orderId || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
