"use client";

import { useMemo, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Boxes,
  ClipboardList,
  FileBarChart2,
  FileText,
  Hammer,
  HeartPulse,
  Home,
  Package,
  Repeat,
  Settings,
  Shield,
  UploadCloud,
  UserSquare2,
  Users,
  X,
} from "lucide-react";

type UserRole = "admin" | "staff";
type NavSection = "core" | "reports" | "system";

type NavItem = {
  id: string;
  label: string;
  href: string;
  section: NavSection;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  roles?: UserRole[];
  badge?: string | number;
  exact?: boolean;
};

type AdminSidebarProps = {
  mobileOpen?: boolean;
  onClose?: () => void;
  userRole?: UserRole;
};

const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: Home,
    section: "core",
    exact: true,
  },
  {
    id: "products",
    label: "Products",
    href: "/products",
    icon: Package,
    section: "core",
  },
  {
    id: "inventory",
    label: "Inventory",
    href: "/inventory",
    icon: Boxes,
    section: "core",
  },
  {
    id: "orders",
    label: "Orders",
    href: "/orders",
    icon: ClipboardList,
    section: "core",
  },
  {
    id: "rentals",
    label: "Rentals",
    href: "/rentals",
    icon: Repeat,
    section: "core",
  },
  {
    id: "users",
    label: "Users",
    href: "/users",
    icon: Users,
    section: "core",
    roles: ["admin"],
  },

  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    icon: FileBarChart2,
    section: "reports",
    exact: true,
  },
  {
    id: "reports-upload",
    label: "Upload & Index",
    href: "/reports/upload",
    icon: UploadCloud,
    section: "reports",
  },
  {
    id: "reports-patients",
    label: "Patients",
    href: "/reports/patients",
    icon: UserSquare2,
    section: "reports",
  },
  {
    id: "reports-hospice",
    label: "Hospice Care",
    href: "/reports/hospice",
    icon: HeartPulse,
    section: "reports",
  },
  {
    id: "reports-wip",
    label: "WIP",
    href: "/reports/wip",
    icon: Hammer,
    section: "reports",
  },
  {
    id: "reports-insurance",
    label: "Insurance",
    href: "/reports/insurance",
    icon: FileText,
    section: "reports",
  },

  {
    id: "audit-logs",
    label: "Audit Logs",
    href: "/audit-logs",
    icon: Shield,
    section: "system",
    roles: ["admin"],
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: Settings,
    section: "system",
    roles: ["admin"],
  },
];

function isActivePath(pathname: string | null, item: NavItem) {
  if (!pathname) return false;

  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AdminSidebar({
  mobileOpen = false,
  onClose,
  userRole = "admin",
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <aside
        id="admin-sidebar"
        aria-label="Primary navigation"
        className="hidden w-64 shrink-0 border-r border-white/10 bg-neutral-950 text-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex"
      >
        <SidebarInner
          pathname={pathname}
          userRole={userRole}
          navKeyPrefix="desktop"
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            title="Close navigation menu"
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />

          <aside
            aria-label="Mobile navigation"
            className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-white/10 bg-neutral-950 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div>
                <div className="text-sm font-semibold tracking-wide">
                  Navigation
                </div>
                <div className="text-xs text-neutral-500">
                  Advanced Home Medical
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                title="Close sidebar"
                aria-label="Close sidebar"
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-white transition hover:border-white/20 hover:bg-white/10"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <SidebarInner
              pathname={pathname}
              userRole={userRole}
              navKeyPrefix="mobile"
              onNavigate={onClose}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}

function SidebarInner({
  pathname,
  userRole,
  navKeyPrefix,
  onNavigate,
}: {
  pathname: string | null;
  userRole: UserRole;
  navKeyPrefix: string;
  onNavigate?: () => void;
}) {
  const groupedItems = useMemo(() => {
    const visibleItems = NAV_ITEMS.filter(
      (item) => !item.roles || item.roles.includes(userRole)
    ).map((item) => ({
      ...item,
      isActive: isActivePath(pathname, item),
    }));

    return {
      core: visibleItems.filter((item) => item.section === "core"),
      reports: visibleItems.filter((item) => item.section === "reports"),
      system: visibleItems.filter((item) => item.section === "system"),
    };
  }, [pathname, userRole]);

  return (
    <div className="flex h-full w-full flex-col p-3">
      <div className="mb-4 rounded-3xl border border-white/10 bg-black/50 px-4 py-5 shadow-lg shadow-black/20">
        <div className="text-xs uppercase tracking-[0.24em] text-neutral-500">
          Advanced Home Medical
        </div>

        <div className="mt-2 text-xl font-bold leading-tight">
          Admin Dashboard
        </div>

        <div className="mt-2 text-sm leading-5 text-neutral-400">
          Operations, reports, insurance, hospice, inventory, and rentals.
        </div>
      </div>

      <nav
        aria-label="Admin sections"
        className="custom-sidebar-scroll flex flex-1 flex-col overflow-y-auto pr-1"
      >
        {groupedItems.core.length > 0 ? (
          <SidebarSection
            title="Operations"
            items={groupedItems.core}
            navKeyPrefix={navKeyPrefix}
            onNavigate={onNavigate}
          />
        ) : null}

        {groupedItems.reports.length > 0 ? (
          <SidebarSection
            title="Reports & Analytics"
            items={groupedItems.reports}
            navKeyPrefix={navKeyPrefix}
            onNavigate={onNavigate}
          />
        ) : null}

        {groupedItems.system.length > 0 ? (
          <SidebarSection
            title="Administration"
            items={groupedItems.system}
            navKeyPrefix={navKeyPrefix}
            onNavigate={onNavigate}
          />
        ) : null}
      </nav>

      <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
        Database Health: Active
      </div>
    </div>
  );
}

function SidebarSection({
  title,
  items,
  navKeyPrefix,
  onNavigate,
}: {
  title: string;
  items: Array<NavItem & { isActive: boolean }>;
  navKeyPrefix: string;
  onNavigate?: () => void;
}) {
  return (
    <section className="mb-5" aria-label={title}>
      <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {title}
      </div>

      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={`${navKeyPrefix}-${item.id}`}
              href={item.href}
              prefetch={false}
              onClick={onNavigate}
              aria-current={item.isActive ? "page" : undefined}
              className={[
                "group relative flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-all duration-200",
                item.isActive
                  ? "border-white/20 bg-white/15 text-white shadow-md shadow-black/20"
                  : "border-white/5 bg-black/20 text-neutral-300 hover:border-white/20 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all duration-200",
                  item.isActive
                    ? "border-white/20 bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-neutral-400 group-hover:border-white/20 group-hover:bg-white/10 group-hover:text-white",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>

              <span className="min-w-0 flex-1 truncate">{item.label}</span>

              {item.badge ? (
                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300">
                  {item.badge}
                </span>
              ) : item.isActive ? (
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full bg-white"
                />
              ) : (
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full bg-transparent transition group-hover:bg-white/40"
                />
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}