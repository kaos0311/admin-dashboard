"use client";

import { type ComponentType, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation, typography } from "@/theme";
import {
  BookOpen,
  Boxes,
  CalendarDays,
  ClipboardList,
  FileBarChart2,
  FileText,
  Hammer,
  HeartPulse,
  Home,
  Medal,
  Package,
  Repeat,
  Settings,
  Shield,
  Siren,
  UploadCloud,
  UserSquare2,
  X,
} from "lucide-react";

type UserRole = "admin" | "staff" | "tank";
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

type GroupedNavItems = Record<
  NavSection,
  Array<NavItem & { isActive: boolean }>
>;

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
    id: "command-center",
    label: "Command Center",
    href: "/command-center",
    icon: Siren,
    section: "core",
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
    id: "rolodex",
    label: "Rolodex",
    href: "/rolodex",
    icon: BookOpen,
    section: "core",
  },
  {
    id: "employee-evaluations",
    label: "Evaluations",
    href: "/employee-evaluations",
    icon: Medal,
    section: "core",
    roles: ["tank"],
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
    id: "reports-cpap",
    label: "CPAP Calendar",
    href: "/reports/cpap",
    icon: CalendarDays,
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

function isActivePath(pathname: string | null, item: NavItem): boolean {
  if (!pathname) return false;

  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function getVisibleGroupedItems(
  pathname: string | null,
  userRole: UserRole
): GroupedNavItems {
  const visibleItems = NAV_ITEMS.filter((item) => {
    return !item.roles || item.roles.includes(userRole);
  }).map((item) => ({
    ...item,
    isActive: isActivePath(pathname, item),
  }));

  return {
    core: visibleItems.filter((item) => item.section === "core"),
    reports: visibleItems.filter((item) => item.section === "reports"),
    system: visibleItems.filter((item) => item.section === "system"),
  };
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
        className={`${navigation.sidebarShell}`}
      >
        <SidebarInner
          pathname={pathname}
          userRole={userRole}
          navKeyPrefix="desktop"
        />
      </aside>

      {mobileOpen ? (
        <div className={navigation.mobileOverlay}>
          <button
            type="button"
            aria-label="Close navigation menu"
            title="Close navigation menu"
            onClick={onClose}
            className={navigation.mobileBackdrop}
          />

          <aside
            aria-label="Mobile navigation"
            className={`${navigation.mobileShell}`}
          >
            <div className={`${navigation.mobileHeader}`}>
              <div>
                <div className={typography.cardTitle}>
                  Navigation
                </div>
                <div className={typography.caption}>
                  Advanced Home Medical
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                title="Close sidebar"
                aria-label="Close sidebar"
                className={`${navigation.closeButton}`}
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
    return getVisibleGroupedItems(pathname, userRole);
  }, [pathname, userRole]);

  return (
    <div className={navigation.inner}>
      <div className={`${navigation.brandCard}`}>
        <div className={typography.caption}>
          Advanced Home Medical
        </div>

        <div className={`mt-2 ${typography.sectionTitle}`}>
          Admin Dashboard
        </div>

        <div className={`mt-2 ${typography.bodyMuted}`}>
          Operations, reports, insurance, hospice, inventory, rentals, and
          command-level oversight.
        </div>
      </div>

      <nav
        aria-label="Admin sections"
        className={navigation.scrollArea}
      >
        <SidebarSection
          title="Operations"
          items={groupedItems.core}
          navKeyPrefix={navKeyPrefix}
          onNavigate={onNavigate}
        />

        <SidebarSection
          title="Reports & Analytics"
          items={groupedItems.reports}
          navKeyPrefix={navKeyPrefix}
          onNavigate={onNavigate}
        />

        <SidebarSection
          title="Administration"
          items={groupedItems.system}
          navKeyPrefix={navKeyPrefix}
          onNavigate={onNavigate}
        />
      </nav>

      <div className={navigation.health}>
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
  if (items.length === 0) {
    return null;
  }

  return (
    <section className={navigation.section} aria-label={title}>
      <div className={`${navigation.sectionLabel} ${typography.caption}`}>
        {title}
      </div>

      <div className={navigation.sectionStack}>
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
                navigation.itemBase,
                item.isActive
                  ? navigation.itemActive
                  : navigation.itemInactive,
              ].join(" ")}
            >
              <span
                className={[
                  navigation.iconBase,
                  item.isActive
                    ? navigation.iconActive
                    : navigation.iconInactive,
                ].join(" ")}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>

              <span className="min-w-0 flex-1 truncate">{item.label}</span>

              {item.badge ? (
                <span className={navigation.badge}>
                  {item.badge}
                </span>
              ) : item.isActive ? (
                <span aria-hidden className={navigation.activeDot} />
              ) : (
                <span
                  aria-hidden
                  className={navigation.inactiveDot}
                />
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

