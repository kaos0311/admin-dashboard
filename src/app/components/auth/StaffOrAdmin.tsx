"use client";

import type { ReactNode } from "react";

import AuthGuard from "@/app/components/auth/AuthGuard";
import { glass } from "@/theme";

type StaffOrAdminProps = {
  children: ReactNode;
};

export default function StaffOrAdmin({
  children,
}: StaffOrAdminProps) {
  return (
    <AuthGuard
      allow={["staff", "admin", "tank"]}
      loadingMessage="Verifying staff access..."
      fallback={
        <div className={glass.pageCenter}>
          <div className={glass.loadingCard}>
            Checking access...
          </div>
        </div>
      }
    >
      {children}
    </AuthGuard>
  );
}



