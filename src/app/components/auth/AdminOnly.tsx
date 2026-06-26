"use client";

import type { ReactNode } from "react";

import AuthGuard from "@/app/components/auth/AuthGuard";

type AdminOnlyProps = {
  children: ReactNode;
};

export default function AdminOnly({
  children,
}: AdminOnlyProps) {
  return (
    <AuthGuard
      allow={["admin"]}
      loadingMessage="Verifying administrator access..."
    >
      {children}
    </AuthGuard>
  );
}



