"use client";

import "./globals.css";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";

import AdminSidebar from "@/app/components/admin/AdminSidebar";
import { AdminShellTopbar } from "./components/admin/AdminShellTopbar";
import StaffOrAdmin from "@/app/components/auth/StaffOrAdmin";
import MaintenanceGate from "@/app/components/MaintenanceGate";
import { useAuthRole } from "@/app/hooks/useAuthRole";
import { ThemeProvider } from "@/app/theme/ThemeProvider";

type RootLayoutProps = {
  children: ReactNode;
};

function AppShell({ children }: RootLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const { isAdmin } = useAuthRole();

  const isLoginPage = pathname === "/login";

  const userEmail = useMemo(() => {
    return user?.email ?? "Signed in";
  }, [user?.email]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthChecked(true);

      if (!firebaseUser && !isLoginPage) {
        router.replace("/login");
      }

      if (firebaseUser && isLoginPage) {
        router.replace("/dashboard");
      }
    });

    return unsubscribe;
  }, [isLoginPage, router]);

  const handleOpenMobileMenu = useCallback(() => {
    setMobileOpen(true);
  }, []);

  const handleCloseMobileMenu = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const handleToggleMobileMenu = useCallback(() => {
    setMobileOpen((previous) => !previous);
  }, []);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      await signOut(auth);
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.10),_transparent_35%),#020617] px-4 text-white light:bg-slate-100 light:text-slate-950">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 text-center shadow-2xl shadow-black/40 backdrop-blur-2xl light:border-slate-200/70 light:bg-white/70 light:shadow-slate-300/40">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-cyan-300 light:border-slate-300 light:border-t-cyan-600" />

          <h1 className="text-lg font-semibold text-white light:text-slate-950">
            Checking access
          </h1>

          <p className="mt-2 text-sm text-zinc-400 light:text-slate-600">
            Verifying staff/admin access before loading operational data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <StaffOrAdmin>
      <MaintenanceGate>
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.10),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.08),_transparent_35%),#020617] text-white transition-colors light:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.10),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.08),_transparent_35%),#f8fafc] light:text-slate-950">
          <a
            href="#admin-main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
          >
            Skip to main content
          </a>

          <AdminSidebar
            mobileOpen={mobileOpen}
            onClose={handleCloseMobileMenu}
          />

          <div className="flex min-h-screen min-w-0 flex-col lg:pl-64">
            <AdminShellTopbar
              userEmail={userEmail}
              isAdmin={isAdmin}
              loggingOut={loggingOut}
              mobileOpen={mobileOpen}
              onOpenMobileMenu={handleToggleMobileMenu}
              onMenuClick={handleOpenMobileMenu}
              onLogout={() => void handleLogout()}
            />

            <main
              id="admin-main-content"
              className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6"
            >
              <div className="mx-auto w-full max-w-[1800px]">
                {children}
              </div>
            </main>
          </div>
        </div>
      </MaintenanceGate>
    </StaffOrAdmin>
  );
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen bg-black text-white antialiased">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}