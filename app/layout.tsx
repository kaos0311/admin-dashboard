
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
import { ThemeProvider } from "@/theme/ThemeProvider";

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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-4 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.14),transparent_32%),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_100%,100%_100%,48px_48px,48px_48px]" />

        <div className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl animate-[reactor-breathe_8s_ease-in-out_infinite]" />

        <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.05] p-7 shadow-[0_20px_80px_rgba(0,0,0,0.45),0_0_60px_rgba(34,211,238,0.10)] backdrop-blur-2xl">
          <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-cyan-300" />

          <h1 className="text-lg font-semibold tracking-tight text-white">
            Checking access
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Verifying staff/admin access before loading operational data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <StaffOrAdmin>
      <MaintenanceGate>
        <div className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
          {/* Atmospheric Background */}
          <div className="pointer-events-none fixed inset-0 -z-30 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.12),transparent_30%),linear-gradient(135deg,#020617_0%,#06111f_45%,#020617_100%)]" />

          {/* Grid */}
          <div className="pointer-events-none fixed inset-0 -z-20 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />

          {/* Arc Reactor Glow */}
          <div className="pointer-events-none fixed left-1/2 top-20 -z-10 h-[540px] w-[540px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.20)_0%,rgba(14,165,233,0.10)_30%,rgba(99,102,241,0.05)_48%,transparent_72%)] blur-3xl opacity-70 animate-[reactor-breathe_8s_ease-in-out_infinite]" />

          {/* Vignette */}
          <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.30)_72%,rgba(0,0,0,0.78)_100%)]" />

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
              className="relative min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6"
            >
              <div className="mx-auto w-full max-w-7xl">
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