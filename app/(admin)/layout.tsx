"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";

import AdminSidebar from "@/app/components/admin/AdminSidebar";
import StaffOrAdmin from "@/app/components/auth/StaffOrAdmin";
import MaintenanceGate from "@/app/components/MaintenanceGate";
import { useAuthRole } from "@/app/hooks/useAuthRole";
import { auth } from "@/lib/firebase";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuthRole();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const openMobileMenu = useCallback(() => {
    setMobileOpen(true);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      await signOut(auth);
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("LOGOUT ERROR:", error);
      setLoggingOut(false);
    }
  }, [loggingOut, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07090d] px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-[#0b1220] px-6 py-4 text-sm text-zinc-300 shadow-2xl shadow-black/30">
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <StaffOrAdmin>
      <MaintenanceGate>
        <div className="min-h-screen bg-[#07090d] text-white">
          <a
            href="#admin-main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
          >
            Skip to main content
          </a>

          <div className="flex min-h-screen">
            <AdminSidebar mobileOpen={mobileOpen} onClose={closeMobileMenu} />

            <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
              <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07090d]/95 backdrop-blur">
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={openMobileMenu}
                      aria-label="Open admin navigation menu"
                      aria-expanded={mobileOpen}
                      aria-controls="admin-sidebar"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 lg:hidden"
                    >
                      <Menu className="h-4 w-4" />
                      Menu
                    </button>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">
                      Welcome
                    </div>
                    <div className="truncate text-sm text-white/65">
                      {user?.email ?? "Signed in"}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <LogOut className="h-4 w-4" />
                      {loggingOut ? "Logging out..." : "Log out"}
                    </button>
                  </div>
                </div>
              </header>

              <main
                id="admin-main-content"
                className="min-w-0 flex-1 px-3 py-4 sm:px-4 lg:px-5 lg:py-5"
              >
                {children}
              </main>
            </div>
          </div>
        </div>
      </MaintenanceGate>
    </StaffOrAdmin>
  );
}