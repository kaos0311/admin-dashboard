import type { ReactNode } from "react";
import AdminShell from "@/app/components/admin/AdminShell";
import AuthGuard from "@/app/components/AuthGuard";

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthGuard>
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  );
}