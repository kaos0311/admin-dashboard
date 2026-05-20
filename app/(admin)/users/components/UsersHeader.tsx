"use client";

import { Plus, Users } from "lucide-react";

type UsersHeaderProps = {
  showCreateForm: boolean;
  onToggleCreateForm: () => void;
};

export function UsersHeader({
  showCreateForm,
  onToggleCreateForm,
}: UsersHeaderProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-white">
            <Users className="h-8 w-8 text-sky-300" />
            Users
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Manage accounts, roles, access, and account status.
          </p>
        </div>

        <button
          type="button"
          title={
            showCreateForm ? "Close create user form" : "Open create user form"
          }
          aria-label={
            showCreateForm ? "Close create user form" : "Open create user form"
          }
          onClick={onToggleCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-black/20 transition hover:bg-white/15"
        >
          <Plus className="h-4 w-4" />
          {showCreateForm ? "Close Create User" : "Create User"}
        </button>
      </div>
    </section>
  );
}