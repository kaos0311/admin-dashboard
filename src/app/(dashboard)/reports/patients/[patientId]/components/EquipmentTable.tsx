import type { CurrentEquipmentItem } from "../patient-detail-types";

import { tables } from "@/theme";

import { formatDate } from "../patient-detail-utils";

export function EquipmentTable({
  items,
}: {
  items: CurrentEquipmentItem[];
}) {
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
        <table className={`${tables.table} min-w-[1000px]`}>
          <thead className={tables.head}>
            <tr>
              <th className={tables.headCell}>Item</th>
              <th className={tables.headCell}>HCPCS</th>
              <th className={tables.headCell}>Type</th>
              <th className={tables.headCell}>Qty</th>
              <th className={tables.headCell}>Status</th>
              <th className={tables.headCell}>Serial</th>
              <th className={tables.headCell}>Lot</th>
              <th className={tables.headCell}>Start</th>
              <th className={tables.headCell}>Maintenance</th>
              <th className={tables.headCell}>Replacement Due</th>
            </tr>
          </thead>

          <tbody className={tables.body}>
            {items.slice(0, 25).map((item, index) => (
              <tr
                key={`${item.itemName}-${item.serialNumber}-${index}`}
                className={tables.row}
              >
                <td className={tables.cellStrong}>
                  {item.itemName || "—"}
                </td>

                <td className={tables.cell}>
                  {item.hcpc || item.itemId || "—"}
                </td>

                <td className={tables.cell}>
                  {item.saleType || "—"}
                </td>

                <td className={tables.cell}>
                  {item.qty ?? "—"}
                </td>

                <td className={tables.cell}>
                  {item.status || "—"}
                </td>

                <td className={tables.cell}>
                  {item.serialNumber || "—"}
                </td>

                <td className={tables.cell}>
                  {item.lotNumber || "—"}
                </td>

                <td className={tables.cell}>
                  {formatDate(item.startDate)}
                </td>

                <td className={tables.cell}>
                  {item.maintenanceStatus || "—"}
                </td>

                <td className={tables.cell}>
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
