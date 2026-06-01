"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

const searchableRoutes = [
  { label: "Dashboard", href: "/dashboard", keywords: "home summary metrics" },
  { label: "Command Center", href: "/command-center", keywords: "operations alerts ai" },
  { label: "Products", href: "/products", keywords: "catalog inventory items" },
  { label: "Inventory", href: "/inventory", keywords: "stock equipment resupply" },
  { label: "Orders", href: "/orders", keywords: "sales orders intake" },
  { label: "Rentals", href: "/rentals", keywords: "rental equipment" },
  { label: "Reports", href: "/reports", keywords: "brightree reporting" },
  { label: "Upload Center", href: "/reports/upload", keywords: "imports upload csv pdf" },
  { label: "Patients", href: "/reports/patients", keywords: "patient profiles demographics" },
  { label: "Hospice", href: "/reports/hospice", keywords: "hospice pickup nurse" },
  { label: "Insurance", href: "/reports/insurance", keywords: "payer authorization coverage" },
  { label: "WIP", href: "/reports/wip", keywords: "work in progress tasks" },
  { label: "Users", href: "/users", keywords: "roles staff admin accounts" },
  { label: "Audit Logs", href: "/audit-logs", keywords: "security history events" },
  { label: "Settings", href: "/settings", keywords: "configuration maintenance" },
];

export function AdminGlobalSearch() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return [];

    return searchableRoutes
      .filter((route) =>
        `${route.label} ${route.href} ${route.keywords}`
          .toLowerCase()
          .includes(needle)
      )
      .slice(0, 6);
  }, [query]);

  return (
    <div className="relative mx-auto max-w-2xl">
      <label htmlFor="admin-global-search" className="sr-only">
        Search admin routes
      </label>

      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
        aria-hidden="true"
      />

      <input
        id="admin-global-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search pages, reports, tools..."
        title="Search admin pages"
        aria-label="Search admin pages"
        autoComplete="off"
        className="w-full rounded-2xl border border-white/10 bg-white/[0.055] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-sky-300/40 focus:bg-white/[0.08]"
      />

      {results.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur-2xl">
          {results.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              onClick={() => setQuery("")}
              className="block border-b border-white/5 px-4 py-3 text-sm text-white transition last:border-b-0 hover:bg-white/10"
            >
              <span className="font-medium">{route.label}</span>
              <span className="ml-2 text-xs text-white/45">{route.href}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}


