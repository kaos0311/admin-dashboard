import type { CurrentEquipmentItem } from "../patient-detail-types";

import { formatDate } from "../patient-detail-utils";

export function EquipmentTable({
  items,
}: {
  items: CurrentEquipmentItem[];
}) {
  if (!items.length) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-500 backdrop-blur-xl">
        No current equipment indexed for this patient.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-white/10 bg-black/20 backdrop-blur-2xl">
      <table className="w-full min-w-[1000px] text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">HCPCS</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Serial</th>
            <th className="px-4 py-3">Lot</th>
            <th className="px-4 py-3">Start</th>
            <th className="px-4 py-3">Maintenance</th>
            <th className="px-4 py-3">Replacement Due</th>
          </tr>
        </thead>

        <tbody>
          {items.slice(0, 25).map((item, index) => (
            <tr
              key={`${item.itemName}-${item.serialNumber}-${index}`}
              className="border-t border-white/10 transition hover:bg-white/[0.04]"
            >
              <td className="px-4 py-3 font-medium text-zinc-100">
                {item.itemName || "—"}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {item.hcpc || item.itemId || "—"}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {item.saleType || "—"}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {item.qty ?? "—"}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {item.status || "—"}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {item.serialNumber || "—"}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {item.lotNumber || "—"}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {formatDate(item.startDate)}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {item.maintenanceStatus || "—"}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {formatDate(item.replacementDueDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}