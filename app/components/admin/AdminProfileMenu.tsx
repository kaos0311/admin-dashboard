"use client";

import Link from "next/link";
import { Loader2, LogOut, Settings, UserCircle } from "lucide-react";
import { useState } from "react";

type AdminProfileMenuProps = {
  userEmail: string;
  isAdmin: boolean;
  loggingOut: boolean;
  onLogout: () => void;
};

export function AdminProfileMenu({
  userEmail,
  isAdmin,
  loggingOut,
  onLogout,
}: AdminProfileMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        title="Open profile menu"
        aria-label="Open profile menu"
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10"
      >
        <UserCircle className="h-4 w-4" aria-hidden="true" />
        <span className="hidden max-w-[140px] truncate lg:inline">
          {isAdmin ? "Admin" : "Staff"}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur-2xl">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-sm font-semibold text-white">
              {isAdmin ? "Administrator" : "Staff User"}
            </div>
            <div className="mt-1 truncate text-xs text-white/50">{userEmail}</div>
          </div>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-b border-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
          >
            <Settings className="h-4 w-4 text-white/50" aria-hidden="true" />
            Settings
          </Link>

          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="h-4 w-4" aria-hidden="true" />
            )}
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}


