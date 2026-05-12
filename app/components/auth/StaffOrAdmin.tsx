"use client";

import type { ReactNode } from "react";
import AuthGuard from "@/app/components/auth/AuthGuard";

export default function StaffOrAdmin({ children }: { children: ReactNode }) {
  return (
    <AuthGuard
      allow={["staff", "admin"]}
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-white">
          <div className="rounded-3xl border border-white/10 bg-neutral-950 px-6 py-4 text-sm text-zinc-300">
            Checking access...
          </div>
        </div>
      }
    >
      {children}
    </AuthGuard>
  );
}