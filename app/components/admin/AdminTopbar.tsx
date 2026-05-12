"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { LogOut, Menu, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

import { auth } from "@/lib/firebase";

type AdminTopbarProps = {
  onMenuClick: () => void;
};

export default function AdminTopbar({ onMenuClick }: AdminTopbarProps) {
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
    } catch (error: unknown) {
      console.error("LOGOUT ERROR:", error);

      toast.error("Failed to log out. Please try again.");
      setLoggingOut(false);
    }
  }, [loggingOut, router]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 text-white backdrop-blur-xl supports-[backdrop-filter]:bg-black/65">
      <div className="flex min-h-[65px] items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            title="Open navigation menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className="h-4 w-4 shrink-0 text-cyan-400"
                aria-hidden
              />

              <h1 className="truncate text-base font-semibold tracking-wide text-white md:text-lg">
                Admin Dashboard
              </h1>
            </div>

            <p className="hidden text-xs text-zinc-500 sm:block">
              Advanced Home Medical
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400 md:block">
            Authenticated Session
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            aria-live="polite"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-600/80 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden
                />
                <span>Logging out...</span>
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4" aria-hidden />
                <span>Logout</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}