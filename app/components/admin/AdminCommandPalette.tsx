"use client";

import Link from "next/link";
import { Command, X } from "lucide-react";
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
        className="hidden rounded-xl border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10 md:inline-flex"
      >
        <Command className="h-4 w-4" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[200] bg-black/60 px-4 py-20 backdrop-blur-sm">
          <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <Command className="h-4 w-4 text-sky-300" aria-hidden="true" />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type a command..."
                title="Search commands"
                aria-label="Search commands"
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />

              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close command palette"
                aria-label="Close command palette"
                className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
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
                  className="block rounded-2xl px-4 py-3 text-sm text-white transition hover:bg-white/10"
                >
                  {command.label}
                </Link>
              ))}

              {filteredCommands.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-white/45">
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
