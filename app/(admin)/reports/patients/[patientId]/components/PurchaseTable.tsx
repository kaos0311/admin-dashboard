import type { RecentPurchaseItem } from "../patient-detail-types";

import { formatDate, formatMoney } from "../patient-detail-utils";

export function PurchaseTable({
  items,
}: {
  items: RecentPurchaseItem[];
}) {
  if (!items.length) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-500 backdrop-blur-xl">
        No purchases indexed in the last 90 days.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-white/10 bg-black/20 backdrop-blur-2xl">
      <table className="w-full min-w-[700px] text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">HCPCS</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Order</th>
          </tr>
        </thead>

        <tbody>
          {items.slice(0, 25).map((item, index) => (
            <tr
              key={`${item.itemName}-${item.orderId}-${index}`}
              className="border-t border-white/10 transition hover:bg-white/[0.04]"
            >
              <td className="px-4 py-3 font-medium text-zinc-100">
                {item.itemName || "—"}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {item.hcpc || item.itemId || "—"}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {formatDate(item.purchaseDate)}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {item.quantity ?? "—"}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {formatMoney(item.amount)}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {item.orderId || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}