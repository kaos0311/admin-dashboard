"use client";

import { useCallback, useState } from "react";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import {
  LogOut,
  Menu,
  ShieldCheck,
} from "lucide-react";

import toast from "react-hot-toast";

import { auth } from "@/lib/firebase";

export default function AdminTopbar({
  onMenuClick,
}: {
  onMenuClick: () => void;
}) {
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await signOut(auth);

      toast.success("Signed out.");

      router.replace("/login");
      router.refresh();
    } catch (err: unknown) {
      console.error("LOGOUT ERROR:", err);

      toast.error("Failed to log out. Please try again.");

      setLoggingOut(false);
    }
  }, [loggingOut, router]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
      <div className="flex min-h-[65px] items-center justify-between gap-4 px-4 py-3">
        {/* LEFT */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            title="Open navigation menu"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-400" />

              <h1 className="truncate text-base font-semibold tracking-wide text-white md:text-lg">
                Admin Dashboard
              </h1>
            </div>

            <div className="hidden text-xs text-zinc-500 sm:block">
              Advanced Home Medical
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3">
          <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400 md:block">
            Authenticated Session
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-600/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Logging out...
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4" />
                Logout
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}