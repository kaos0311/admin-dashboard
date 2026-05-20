import {
  BarChart3,
  HeartPulse,
  ShieldCheck,
  Truck,
  Upload,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type ReportPageConfig = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: string;
};

export const reportPages: ReportPageConfig[] = [
  {
    title: "Upload Center",
    description: "Master importer for Brightree reports and weekly data refreshes.",
    href: "/reports/upload",
    icon: Upload,
    tone: "text-cyan-200",
  },
  {
    title: "Analytics",
    description: "Aggregate totals, report classification, and rebuild status.",
    href: "/reports/analytics",
    icon: BarChart3,
    tone: "text-blue-200",
  },
  {
    title: "Patients",
    description: "Patient profiles, demographics, birthdays, and history.",
    href: "/reports/patients",
    icon: Users,
    tone: "text-sky-200",
  },
  {
    title: "Hospice",
    description: "Hospice oversight, nurse gaps, pickup risk, and status tracking.",
    href: "/reports/hospice",
    icon: HeartPulse,
    tone: "text-rose-200",
  },
  {
    title: "Work In Progress",
    description: "Open work, assigned employees, unresolved issues, and bottlenecks.",
    href: "/reports/wip",
    icon: Wrench,
    tone: "text-amber-200",
  },
  {
    title: "Insurance",
    description: "Payer records, coverage data, and insurance queues.",
    href: "/reports/insurance",
    icon: ShieldCheck,
    tone: "text-emerald-200",
  },
  {
    title: "Delivery",
    description: "Delivery tickets, item movement, and equipment history.",
    href: "/reports/delivery",
    icon: Truck,
    tone: "text-lime-200",
  },
];