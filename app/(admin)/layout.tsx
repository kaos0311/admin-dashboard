"use client";

import { type ReactNode, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { signOut } from "firebase/auth";

import AdminSidebar from "@/app/components/admin/AdminSidebar";
import { JarvisSafetyInterlock } from "@/app/components/admin/JarvisSafetyInterlock";
import StaffOrAdmin from "@/app/components/auth/StaffOrAdmin";
import MaintenanceGate from "@/app/components/MaintenanceGate";
import { useAuthRole } from "@/app/hooks/useAuthRole";
import { auth } from "@/lib/firebase";
import { colors, glass, spacing, typography } from "@/theme";

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const { user, role, loading } = useAuthRole();

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

    setLoggingOut(true);

    try {
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
      <div className={`${colors.app} flex min-h-screen items-center justify-center px-4`}>
        <div className={`${glass.card} ${spacing.section}`}>
          <p className={typography.bodyMuted}>Loading command center...</p>
        </div>
      </div>
    );
  }

  return (
    <StaffOrAdmin>
      <MaintenanceGate>
        <div className={`admin-page ${colors.app} min-h-screen ${colors.textPrimary}`}>
          <div className={colors.grid} />
          <div className={colors.vignette} />
          <JarvisSafetyInterlock />

          <a
            href="#admin-main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
          >
            Skip to main content
          </a>

          <div className="flex min-h-screen min-w-0">
            <AdminSidebar
              mobileOpen={mobileOpen}
              onClose={closeMobileMenu}
              userRole={role ?? "staff"}
            />

            <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
              <header className={`${glass.toolbar} sticky top-0 z-30 rounded-none border-x-0 border-t-0`}>
                <div className="grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={openMobileMenu}
                      aria-label="Open admin navigation menu"
                      aria-expanded={mobileOpen}
                      aria-controls="admin-sidebar"
                      className={`${glass.focus} inline-flex items-center gap-2 rounded-xl border ${colors.border} bg-white/5 px-3 py-2 text-sm font-medium ${colors.textPrimary} transition hover:bg-white/10 lg:hidden`}
                    >
                      <Menu className="h-4 w-4" />
                      Menu
                    </button>
                  </div>

                  <div className="min-w-0">
                    <div className={`text-sm font-medium ${colors.textPrimary}`}>
                      Welcome
                    </div>

                    <div className={`truncate text-sm ${colors.textMuted}`}>
                      {user?.email ?? "Signed in"}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className={`${glass.focus} inline-flex items-center gap-2 rounded-xl border ${colors.borderStrong} bg-white/5 px-4 py-2 text-sm font-medium ${colors.textPrimary} transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <LogOut className="h-4 w-4" />
                      {loggingOut ? "Logging out..." : "Log out"}
                    </button>
                  </div>
                </div>
              </header>

              <main
                id="admin-main-content"
                className="min-w-0 flex-1 overflow-x-hidden"
              >
                <div className={`${glass.shellFull} ${spacing.page}`}>
                  {children}
                </div>
              </main>
            </div>
          </div>
        </div>
      </MaintenanceGate>
    </StaffOrAdmin>
  );
}



