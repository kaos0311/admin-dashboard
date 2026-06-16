"use client";

import Link from "next/link";
import { Bell, CircleAlert } from "lucide-react";
import { useState } from "react";

import { badges, glass, typography } from "@/theme";

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
        className={`${glass.inset} relative p-2 transition hover:scale-[1.02]`}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />

        {notifications.length > 0 ? (
          <span
            className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ${badges.danger}`}
          />
        ) : null}
      </button>

      {open ? (
        <div
          className={`${glass.card} absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden`}
        >
          <div className={`${glass.divider} px-4 py-3`}>
            <span className={typography.cardTitle}>Notifications</span>
          </div>

          {notifications.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setOpen(false)}
              className={glass.menuItem}
            >
              <CircleAlert
                className={`mt-0.5 h-4 w-4 shrink-0 ${badges.warning}`}
                aria-hidden="true"
              />

              <span>
                <span className={`block ${typography.label}`}>
                  {item.label}
                </span>

                <span className={`mt-1 block ${typography.caption}`}>
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

