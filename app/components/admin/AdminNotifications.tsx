"use client";

import Link from "next/link";
import { Bell, CircleAlert } from "lucide-react";
import { useState } from "react";

const notifications = [
  {
    id: "upload-review",
    label: "Review recent uploads",
    detail: "Check stuck import jobs and processor health.",
    href: "/reports/upload",
  },
  {
    id: "audit-review",
    label: "Audit logs available",
    detail: "Review admin activity and destructive actions.",
    href: "/audit-logs",
  },
];

export function AdminNotifications() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        title="Open notifications"
        aria-label="Open notifications"
        className="relative rounded-xl border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />

        {notifications.length > 0 ? (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-400 ring-2 ring-slate-950" />
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur-2xl">
          <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">
            Notifications
          </div>

          {notifications.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex gap-3 border-b border-white/5 px-4 py-3 transition last:border-b-0 hover:bg-white/10"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>
                <span className="block text-sm font-medium text-white">
                  {item.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-white/50">
                  {item.detail}
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}



