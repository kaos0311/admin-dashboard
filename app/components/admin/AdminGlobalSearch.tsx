"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { glass, typography } from "@/theme";

const searchableRoutes = [
  { label: "Command Center", href: "/command-center", keywords: "operations alerts ai" },
  { label: "Products", href: "/products", keywords: "catalog inventory items" },
  { label: "Inventory", href: "/inventory", keywords: "stock equipment resupply" },
  { label: "Orders", href: "/orders", keywords: "sales orders intake" },
  { label: "Rentals", href: "/rentals", keywords: "rental equipment" },
  { label: "Rolodex", href: "/rolodex", keywords: "contacts vendors hospice insurance facilities phone email" },
  { label: "Reports", href: "/reports", keywords: "brightree reporting" },
  { label: "Upload Center", href: "/reports/upload", keywords: "imports upload csv pdf" },
  { label: "Patients", href: "/reports/patients", keywords: "patient profiles demographics" },
  { label: "Hospice", href: "/reports/hospice", keywords: "hospice pickup nurse" },
  { label: "Insurance", href: "/reports/insurance", keywords: "payer authorization coverage" },
  { label: "WIP", href: "/reports/wip", keywords: "work in progress tasks" },
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
        className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${typography.caption}`}
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
        className={`${glass.input} py-2.5 pl-10 pr-4 text-sm`}
      />

      {results.length > 0 ? (
        <div className={`${glass.card} absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden`}>
          {results.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              onClick={() => setQuery("")}
              className={glass.menuItem}
            >
              <span className="font-medium">{route.label}</span>
              <span className={`ml-2 ${typography.caption}`}>{route.href}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

