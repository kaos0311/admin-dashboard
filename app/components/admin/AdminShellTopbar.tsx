"use client";

import {
  Bell,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import ThemeToggle from "../../theme/ThemeToggle";

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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 px-4 py-3 text-white shadow-2xl shadow-black/20 backdrop-blur-2xl transition-colors light:border-slate-200/70 light:bg-white/70 light:text-slate-950 light:shadow-slate-300/40">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={handleMenuClick}
            aria-label={
              mobileOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={mobileOpen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-zinc-200 transition hover:bg-white/[0.12] light:border-slate-200 light:bg-white/70 light:text-slate-800 light:hover:bg-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80 light:text-cyan-700">
              Advanced Home Medical
            </p>

            <h1 className="truncate text-base font-semibold text-white light:text-slate-950 sm:text-lg">
              Operations Command
            </h1>
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <div className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-zinc-400 shadow-inner backdrop-blur-xl transition-colors light:border-slate-200 light:bg-white/70 light:text-slate-500">
            <Search className="h-4 w-4 shrink-0 text-zinc-500 light:text-slate-400" />
            <span className="truncate">
              Search lives on the page level. No PHI exposed here.
            </span>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <div className="hidden items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-200 transition-colors light:border-emerald-200 light:bg-emerald-50 light:text-emerald-700 sm:flex">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {isAdmin ? "Admin" : "Staff"}
          </div>

          <div className="hidden max-w-[220px] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-zinc-300 transition-colors light:border-slate-200 light:bg-white/70 light:text-slate-600 sm:flex">
            <UserRound className="h-4 w-4 shrink-0 text-zinc-400 light:text-slate-500" />
            <span className="truncate">{userEmail}</span>
          </div>

          <ThemeToggle />

          <button
            type="button"
            aria-label="View notifications"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-zinc-200 transition hover:bg-white/[0.12] light:border-slate-200 light:bg-white/70 light:text-slate-800 light:hover:bg-white"
          >
            <Bell className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            aria-label="Sign out"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 px-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 light:border-red-200 light:bg-red-50 light:text-red-700 light:hover:bg-red-100"
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