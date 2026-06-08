"use client";

import Link from "next/link";
import { Command, X } from "lucide-react";

import { buttons, forms, glass, typography } from "@/theme";
import { useEffect, useMemo, useState } from "react";

const commands = [
  { label: "Open Dashboard", href: "/dashboard" },
  { label: "Open Upload Center", href: "/reports/upload" },
  { label: "Open Command Center", href: "/command-center" },
  { label: "Open Patients", href: "/reports/patients" },
  { label: "Open Hospice", href: "/reports/hospice" },
  { label: "Open Insurance", href: "/reports/insurance" },
  { label: "Open WIP", href: "/reports/wip" },
  { label: "Open Audit Logs", href: "/audit-logs" },
  { label: "Open Settings", href: "/settings" },
];

export function AdminCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredCommands = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return commands;

    return commands.filter((command) =>
      command.label.toLowerCase().includes(needle)
    );
  }, [query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open command palette"
        aria-label="Open command palette"
        className={`${buttons.secondary} hidden p-2 md:inline-flex`}
      >
        <Command className="h-4 w-4" aria-hidden="true" />
      </button>

      {open ? (
        <div className={`bg-black/60 fixed inset-0 z-[200] px-4 py-20 backdrop-blur-sm`}>
          <div className={`${glass.shell} mx-auto max-w-xl overflow-hidden`}>
            <div className={`${glass.toolbar} flex items-center gap-3 px-4 py-3`}>
              <Command className="h-4 w-4" aria-hidden="true" />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type a command..."
                title="Search commands"
                aria-label="Search commands"
                autoFocus
                className={`${forms.input} min-w-0 flex-1 border-0 bg-transparent shadow-none`}
              />

              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close command palette"
                aria-label="Close command palette"
                className={`${buttons.ghost} p-2`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-2">
              {filteredCommands.map((command) => (
                <Link
                  key={command.href}
                  href={command.href}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`block rounded-2xl px-4 py-3 ${typography.body} transition hover:bg-white/10`}
                >
                  {command.label}
                </Link>
              ))}

              {filteredCommands.length === 0 ? (
                <div className={`px-4 py-8 text-center ${typography.bodyMuted}`}>
                  No commands found.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}





