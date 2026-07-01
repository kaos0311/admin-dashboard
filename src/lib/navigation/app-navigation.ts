import {
  ClipboardList,
  Gauge,
  type LucideIcon,
  Package,
  Users,
  Wrench,
} from "lucide-react";

export type AppNavigationItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const appNavigation: AppNavigationItem[] = [
  { title: "Dashboard", href: "/", icon: Gauge },
  { title: "Equipment", href: "/equipment", icon: Package },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Work Orders", href: "/work-orders", icon: ClipboardList },
  { title: "Repairs", href: "/repairs", icon: Wrench },
];

