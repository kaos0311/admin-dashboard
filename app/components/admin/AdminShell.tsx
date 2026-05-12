"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

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

  useEffect(() => {
    if (!sidebarOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSidebar();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [sidebarOpen, closeSidebar]);

  return (
    <div className="min-h-screen bg-[#07090d] text-white">
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        Skip to main content
      </a>

      <div className="flex min-h-screen">
        <AdminSidebar mobileOpen={sidebarOpen} onClose={closeSidebar} />

        <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
          <AdminTopbar onMenuClick={openSidebar} />

          <main
            id="admin-main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 overflow-x-hidden bg-[#07090d] outline-none"
          >
            <div className="mx-auto min-h-[calc(100vh-65px)] w-full max-w-[1800px] px-3 py-4 sm:px-4 md:px-5 lg:px-6 xl:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}