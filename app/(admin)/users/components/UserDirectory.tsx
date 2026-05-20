"use client";

import { Loader2, RefreshCw } from "lucide-react";

import type { UserRole } from "@/lib/adminUsers";
import type { UserRow } from "../users-types";
import { UserRowCard } from "./UserRowCard";

type UserDirectoryProps = {
  filteredUsers: UserRow[];
  loadingUsers: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  currentUid: string;
  busyUid: string | null;
  onLoadMore: () => void;
  onRoleChange: (user: UserRow, nextRole: UserRole) => void;
  onToggleActive: (user: UserRow) => void;
  onDeleteUser: (user: UserRow) => void;
};

export function UserDirectory({
  filteredUsers,
  loadingUsers,
  hasMore,
  loadingMore,
  currentUid,
  busyUid,
  onLoadMore,
  onRoleChange,
  onToggleActive,
  onDeleteUser,
}: UserDirectoryProps) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/80 px-5 py-4 backdrop-blur-2xl">
        <h2 className="text-lg font-semibold text-white">User Directory</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {filteredUsers.length} visible user
          {filteredUsers.length === 1 ? "" : "s"}
        </p>
      </div>

      {loadingUsers ? (
        <div className="flex items-center gap-3 px-5 py-10 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading users...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="px-5 py-10 text-sm text-zinc-400">No users found.</div>
      ) : (
        <div className="divide-y divide-white/10">
          {filteredUsers.map((user) => (
            <UserRowCard
              key={user.uid}
              user={user}
              currentUid={currentUid}
              busyUid={busyUid}
              onRoleChange={onRoleChange}
              onToggleActive={onToggleActive}
              onDeleteUser={onDeleteUser}
            />
          ))}
        </div>
      )}

      {!loadingUsers && hasMore ? (
        <div className="border-t border-white/10 px-5 py-5">
          <button
            type="button"
            title="Load more users"
            aria-label="Load more users"
            disabled={loadingMore}
            onClick={onLoadMore}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Load More Users
          </button>
        </div>
      ) : null}
    </section>
  );
}