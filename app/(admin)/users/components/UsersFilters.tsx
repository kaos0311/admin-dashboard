"use client";

import { Search } from "lucide-react";
import type { UserRole } from "@/lib/adminUsers";
import { SelectInput } from "./SelectInput";

type UsersFiltersProps = {
  searchInput: string;
  setSearchInput: (value: string) => void;
  roleFilter: "all" | UserRole;
  setRoleFilter: (value: "all" | UserRole) => void;
  statusFilter: "all" | "active" | "disabled";
  setStatusFilter: (value: "all" | "active" | "disabled") => void;
};

export function UsersFilters({
  searchInput,
  setSearchInput,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
}: UsersFiltersProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label htmlFor="user-search" className="mb-2 block text-sm text-zinc-400">
            Search
          </label>

          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/50 px-4 py-3">
            <Search className="h-4 w-4 text-zinc-500" />

            <input
              id="user-search"
              type="text"
              value={searchInput}
              title="Search users"
              aria-label="Search users"
              placeholder="Search by email, name, phone, or UID"
              onChange={(event) => setSearchInput(event.target.value)}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
              autoComplete="off"
            />
          </div>
        </div>

        <SelectInput
          label="Role"
          value={roleFilter}
          onChange={(value) => setRoleFilter(value as "all" | UserRole)}
          options={[
            { value: "all", label: "All roles" },
            { value: "admin", label: "Admin" },
            { value: "staff", label: "Staff" },
          ]}
        />

        <SelectInput
          label="Status"
          value={statusFilter}
          onChange={(value) =>
            setStatusFilter(value as "all" | "active" | "disabled")
          }
          options={[
            { value: "all", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "disabled", label: "Disabled" },
          ]}
        />
      </div>
    </section>
  );
}