"use client";

import type { ReactNode } from "react";

import AuthGuard from "@/app/components/auth/AuthGuard";
import { COMMAND_CENTER_ROLES } from "@/lib/permissions/roles";
import { glass } from "@/theme";

type StaffOrAdminProps = {
  children: ReactNode;
};

export default function StaffOrAdmin({
  children,
}: StaffOrAdminProps) {
  return (
    <AuthGuard
      allow={COMMAND_CENTER_ROLES}
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



