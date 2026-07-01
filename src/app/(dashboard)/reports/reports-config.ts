import {
  BarChart3,
  CalendarDays,
  HeartPulse,
  type LucideIcon,
  ShieldCheck,
  Truck,
  Upload,
  Users,
  Wrench,
} from "lucide-react";

export type ReportPageCategory =
  | "core"
  | "analytics"
  | "clinical"
  | "operations";

export type ReportPageConfig = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: string;
  category: ReportPageCategory;

  /**
   * Future-ready flags
   */
  disabled?: boolean;
  comingSoon?: boolean;
  adminOnly?: boolean;
};

export const reportPages: readonly ReportPageConfig[] = [
  {
    title: "Upload Center",
    description:
      "Master importer for Brightree reports, overwrite workflows, and weekly data refreshes.",
    href: "/reports/upload",
    icon: Upload,
    tone: "text-cyan-200",
    category: "core",
  },

  {
    title: "Analytics",
    description:
      "Aggregate totals, report classification, indexing status, and operational visibility.",
    href: "/reports/analytics",
    icon: BarChart3,
    tone: "text-blue-200",
    category: "analytics",
  },

  {
    title: "Patients",
    description:
      "Patient profiles, demographics, birthdays, operational history, and reporting visibility.",
    href: "/reports/patients",
    icon: Users,
    tone: "text-sky-200",
    category: "clinical",
  },

  {
    title: "CPAP Calendar",
    description:
      "Setup appointments, pickup readiness, supply intervals, and Medicare-aware resupply checks.",
    href: "/reports/cpap",
    icon: CalendarDays,
    tone: "text-cyan-200",
    category: "clinical",
  },

  {
    title: "Hospice",
    description:
      "Hospice oversight, nurse gaps, pickup risk, and patient status monitoring.",
    href: "/reports/hospice",
    icon: HeartPulse,
    tone: "text-rose-200",
    category: "clinical",
  },

  {
    title: "Work In Progress",
    description:
      "Open work, employee assignment, unresolved bottlenecks, and production accountability.",
    href: "/reports/wip",
    icon: Wrench,
    tone: "text-amber-200",
    category: "operations",
  },

  {
    title: "Insurance",
    description:
      "Payer records, coverage verification, authorization tracking, and insurance queues.",
    href: "/reports/insurance",
    icon: ShieldCheck,
    tone: "text-emerald-200",
    category: "clinical",
  },

  {
    title: "Delivery",
    description:
      "Delivery tickets, equipment movement, route visibility, and chain-of-custody tracking.",
    href: "/reports/delivery",
    icon: Truck,
    tone: "text-lime-200",
    category: "operations",
  },
] as const;


