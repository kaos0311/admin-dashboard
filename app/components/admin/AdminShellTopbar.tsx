"use client";

import {
  Bell,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import ThemeToggle from "@/theme/ThemeToggle";
import { colors, glass } from "@/theme";

type AdminShellTopbarProps = {
  userEmail?: string;
  isAdmin?: boolean;
  loggingOut?: boolean;
  mobileOpen?: boolean;
  onOpenMobileMenu?: () => void;
  onMenuClick?: () => void;
  onLogout?: () => void;
};

export function AdminShellTopbar({
  userEmail = "Signed in",
  isAdmin = false,
  loggingOut = false,
  mobileOpen = false,
  onOpenMobileMenu,
  onMenuClick,
  onLogout,
}: AdminShellTopbarProps) {
  const handleMenuClick = onOpenMobileMenu ?? onMenuClick;

  return (
    <header
      className={`${glass.toolbar} sticky top-0 z-40 rounded-none border-x-0 border-t-0 px-4 py-3 transition-colors`}
    >
      <div className="flex min-w-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={handleMenuClick}
            aria-label={
              mobileOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={mobileOpen}
            className={`${glass.focus} inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${colors.border} bg-white/[0.06] ${colors.textSecondary} transition hover:bg-white/[0.12] lg:hidden`}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
              Advanced Home Medical
            </p>

            <h1 className={`truncate text-base font-semibold sm:text-lg ${colors.textPrimary}`}>
              Operations Command
            </h1>
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <div className={`flex w-full max-w-md items-center gap-2 rounded-2xl border ${colors.border} bg-white/[0.06] px-3 py-2 text-sm ${colors.textMuted} shadow-inner backdrop-blur-xl transition-colors`}>
            <Search className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="truncate">
              Search lives on the page level. No PHI exposed here.
            </span>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <div className="hidden items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-200 sm:flex">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {isAdmin ? "Admin" : "Staff"}
          </div>

          <div className={`hidden max-w-[220px] items-center gap-2 rounded-2xl border ${colors.border} bg-white/[0.06] px-3 py-2 text-xs ${colors.textSecondary} sm:flex`}>
            <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate">{userEmail}</span>
          </div>

          <ThemeToggle />

          <button
            type="button"
            aria-label="View notifications"
            className={`${glass.focus} inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${colors.border} bg-white/[0.06] ${colors.textSecondary} transition hover:bg-white/[0.12]`}
          >
            <Bell className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            aria-label="Sign out"
            className={`${glass.focus} inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 px-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">
              {loggingOut ? "Signing out..." : "Logout"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}


