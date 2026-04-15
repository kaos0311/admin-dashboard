"use client";

import Link from "next/link";
import { useAuthRole } from "@/app/hooks/useAuthRole";

export default function AdminSidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const { isAdmin } = useAuthRole();

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-white/10 bg-[#0b0b0f] p-4 transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <h2 className="mb-6 text-xl font-bold">Admin</h2>

        <nav className="space-y-2">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="block rounded-lg p-2 hover:bg-white/10"
          >
            Dashboard
          </Link>

          <Link
            href="/products"
            onClick={onClose}
            className="block rounded-lg p-2 hover:bg-white/10"
          >
            Products
          </Link>

          <Link
            href="/orders"
            onClick={onClose}
            className="block rounded-lg p-2 hover:bg-white/10"
          >
            Orders
          </Link>

          <Link
            href="/rentals"
            onClick={onClose}
            className="block rounded-lg p-2 hover:bg-white/10"
          >
            Rentals
          </Link>

          {isAdmin && (
            <Link
              href="/users"
              onClick={onClose}
              className="block rounded-lg p-2 hover:bg-white/10"
            >
              Users
            </Link>
          )}

          <Link
            href="/settings"
            onClick={onClose}
            className="block rounded-lg p-2 hover:bg-white/10"
          >
            Settings
          </Link>
        </nav>
      </aside>
    </>
  );
}