import Link from "next/link";

import { appNavigation } from "@/lib/navigation/app-navigation";

export function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-72 border-r border-slate-800 bg-slate-950 text-white lg:block">
      <div className="border-b border-slate-800 px-6 py-5">
        <h1 className="text-xl font-bold tracking-tight">
          Advanced Home Medical
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Inventory Management
        </p>
      </div>

      <nav className="space-y-1 px-3 py-4">
        {appNavigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white"
          >
            {item.title}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
