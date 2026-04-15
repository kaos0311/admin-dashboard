"use client";

import { useAuthRole } from "@/app/hooks/useAuthRole";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  Users,
  Shield,
  UserCog,
  Search,
  Loader2,
  Save,
  AlertTriangle,
} from "lucide-react";

type UserRole = "admin" | "staff";

type AppUser = {
  id: string;
  email?: string;
  displayName?: string;
  role?: UserRole;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};

function formatDate(timestamp?: Timestamp | null) {
  if (!timestamp) return "—";

  try {
    return timestamp.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function getRoleClasses(role?: UserRole) {
  switch (role) {
    case "admin":
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
    case "staff":
      return "bg-sky-500/15 text-sky-300 border border-sky-500/20";
    default:
      return "bg-slate-500/15 text-slate-300 border border-slate-500/20";
  }
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-[#111827] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-white">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-[#111827] shadow-sm">
      <div className="border-b border-white/10 px-6 py-5">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        ) : null}
      </div>

      <div className="p-6">{children}</div>
    </div>
  );
}

export default function UsersPage() {
  const { isAdmin, loading: roleLoading } = useAuthRole();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editedRoles, setEditedRoles] = useState<Record<string, UserRole>>({});

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      setError("You must be signed in to view users.");
      return;
    }

    const q = query(collection(db, "users"), orderBy("email"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextUsers: AppUser[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Omit<AppUser, "id">;

          return {
            id: docSnap.id,
            ...data,
            role: (data.role as UserRole) ?? "staff",
          };
        });

        setUsers(nextUsers);

        setEditedRoles((prev) => {
          const next = { ...prev };

          for (const user of nextUsers) {
            if (!next[user.id]) {
              next[user.id] = (user.role as UserRole) ?? "staff";
            }
          }

          return next;
        });

        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading users:", err);
        setError(err.message || "Failed to load users.");
        setLoading(false);
      }
    );

    return () => {
      try {
        unsubscribe();
      } catch (err) {
        console.warn("Users unsubscribe failed:", err);
      }
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      const email = user.email?.toLowerCase() ?? "";
      const displayName = user.displayName?.toLowerCase() ?? "";
      const role = user.role?.toLowerCase() ?? "";
      const id = user.id.toLowerCase();

      return (
        !term ||
        email.includes(term) ||
        displayName.includes(term) ||
        role.includes(term) ||
        id.includes(term)
      );
    });
  }, [users, search]);

  const totalUsers = users.length;
  const adminUsers = users.filter((u) => (u.role ?? "staff") === "admin").length;
  const staffUsers = users.filter((u) => (u.role ?? "staff") === "staff").length;

  async function handleSaveRole(userId: string) {
    if (!isAdmin) return;
    if (auth.currentUser?.uid === userId) {
      alert("You cannot change your own role.");
      return;
    }

    const nextRole = editedRoles[userId];

    if (!nextRole) {
      alert("Please choose a valid role.");
      return;
    }

    setSavingUserId(userId);

    try {
      await updateDoc(doc(db, "users", userId), {
        role: nextRole,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error updating role:", err);
      alert("Failed to update user role.");
    } finally {
      setSavingUserId(null);
    }
  }

  if (roleLoading) {
    return (
      <div className="space-y-6 p-6 text-white">
        <div className="flex min-h-[200px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20">
          <div className="inline-flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-3 text-sm text-slate-300 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading permissions...
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6 p-6 text-white">
        <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/10 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
            <div>
              <h1 className="text-xl font-semibold text-white">
                Access denied
              </h1>
              <p className="mt-2 text-sm text-amber-200/90">
                Only admins can manage user roles.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 text-white">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Users & Roles
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Manage dashboard access for admins and staff.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Users"
          value={totalUsers}
          subtitle="Total user accounts"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Admins"
          value={adminUsers}
          subtitle="Full dashboard access"
          icon={<Shield className="h-5 w-5" />}
        />
        <StatCard
          title="Staff"
          value={staffUsers}
          subtitle="Limited operational access"
          icon={<UserCog className="h-5 w-5" />}
        />
      </div>

      <SectionCard
        title="Team Access"
        subtitle="Search users, review roles, and update permissions."
      >
        <div className="mb-5">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email, name, role, or user ID"
              className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500"
            />
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20">
              <div className="inline-flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-3 text-sm text-slate-300 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading users...
              </div>
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-300">
              {error}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-black/20 text-slate-400 shadow-sm">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                No users found
              </h3>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                Try adjusting your search.
              </p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const currentRole = (user.role ?? "staff") as UserRole;
              const selectedRole = editedRoles[user.id] ?? currentRole;
              const isCurrentUser = auth.currentUser?.uid === user.id;
              const isDirty = selectedRole !== currentRole;
              const isSaving = savingUserId === user.id;

              return (
                <div
                  key={user.id}
                  className="rounded-3xl bg-black/20 p-5 transition hover:bg-white/[0.04]"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-white">
                          {user.displayName?.trim() || "Unnamed User"}
                        </h3>

                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRoleClasses(
                            currentRole
                          )}`}
                        >
                          {currentRole}
                        </span>

                        {isCurrentUser && (
                          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                            You
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
                        <span>Email: {user.email || "—"}</span>
                        <span>Created: {formatDate(user.createdAt)}</span>
                        <span>Updated: {formatDate(user.updatedAt)}</span>
                      </div>

                      <p className="mt-2 break-all text-xs text-slate-500">
                        UID: {user.id}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="flex flex-col gap-1">
                        <select
                          value={selectedRole}
                          onChange={(e) =>
                            setEditedRoles((prev) => ({
                              ...prev,
                              [user.id]: e.target.value as UserRole,
                            }))
                          }
                          disabled={isCurrentUser}
                          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="staff" className="bg-[#111827]">
                            staff
                          </option>
                          <option value="admin" className="bg-[#111827]">
                            admin
                          </option>
                        </select>

                        {isCurrentUser && (
                          <p className="text-xs text-amber-400">
                            You cannot change your own role
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveRole(user.id)}
                        disabled={!isDirty || isSaving || isCurrentUser}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Save Role
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SectionCard>
    </div>
  );
}