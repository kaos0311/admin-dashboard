import Link from "next/link";

import { appNavigation } from "@/lib/navigation/app-navigation";

export function MobileNav() {
  return (
    <div className="border-b border-slate-800 bg-slate-950 p-3 text-white lg:hidden">
      <div className="mb-3">
        <h1 className="text-lg font-bold">Advanced Home Medical</h1>
        <p className="text-xs text-slate-400">Inventory Management</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {appNavigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300"
          >
            {item.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
