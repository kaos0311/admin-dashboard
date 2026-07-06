import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";

export default async function EquipmentPage() {
  await requireUser();

  const equipment = await prisma.equipment.findMany({
    include: {
      model: {
        include: {
          manufacturer: true,
        },
      },
      location: true,
      customer: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Equipment Inventory
        </h1>
        <p className="text-sm text-slate-500">
          View and manage all tracked medical equipment assets.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Asset Tag</th>
                <th className="px-4 py-3">Manufacturer</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Customer</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {equipment.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No equipment found.
                  </td>
                </tr>
              ) : (
                equipment.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {item.assetTag}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.model?.manufacturer?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.model?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.model?.category ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.location?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.customer?.name ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
