import {
  ClipboardList,
  FileText,
  Gauge,
  Package,
  Settings,
  Stethoscope,
  Truck,
  type LucideIcon,
  Users,
  Wrench,
} from "lucide-react";

export type AppNavigationItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const appNavigation: AppNavigationItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: Gauge },

  { title: "Inventory", href: "/inventory", icon: Package },
  { title: "Asset Records", href: "/inventory/asset-records", icon: FileText },
  { title: "Rental Property", href: "/inventory/rental-property", icon: Truck },

  { title: "Patients", href: "/patients", icon: Users },
  { title: "Hospice", href: "/reports/hospice", icon: Stethoscope },
  { title: "CPAP Reports", href: "/reports/cpap", icon: Stethoscope },

  { title: "Orders", href: "/orders", icon: ClipboardList },
  { title: "Rentals", href: "/rentals", icon: Truck },
  { title: "Repairs", href: "/repairs", icon: Wrench },

  { title: "Settings", href: "/settings", icon: Settings },
];