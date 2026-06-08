"use client";

import type { ReactNode } from "react";

import AuthGuard from "@/app/components/auth/AuthGuard";

type StaffOrAdminProps = {
  children: ReactNode;
};

export default function StaffOrAdmin({
  children,
}: StaffOrAdminProps) {
  return (
    <AuthGuard
      allow={["staff", "admin"]}
      loadingMessage="Verifying staff access..."
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_34%),#020617] px-4 text-white">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] px-6 py-4 text-sm text-zinc-300 shadow-2xl shadow-black/30 backdrop-blur-2xl">
            Checking access...
          </div>
        </div>
      }
    >
      {children}
    </AuthGuard>
  );
}



