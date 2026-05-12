"use client";

import { useCallback, useState, type ReactNode } from "react";

import AdminSidebar from "@/app/components/admin/AdminSidebar";
import AdminTopbar from "@/app/components/admin/AdminTopbar";

export default function AdminShell({
  children,
}: {
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const openSidebar = useCallback(() => {
    setSidebarOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-[#07090d] text-white">
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
      >
        Skip to main content
      </a>

      <div className="flex min-h-screen">
        <AdminSidebar mobileOpen={sidebarOpen} onClose={closeSidebar} />

        <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
          <AdminTopbar onMenuClick={openSidebar} />

          <main
            id="admin-main-content"
            className="min-w-0 flex-1 overflow-x-hidden bg-[#07090d]"
          >
            <div className="min-h-[calc(100vh-65px)] px-3 py-4 sm:px-4 md:px-5 lg:px-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}