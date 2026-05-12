"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { unstable_batchedUpdates } from "react-dom";
import toast from "react-hot-toast";
import {
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserCog,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";

import { db, auth } from "@/lib/firebase";
import { useAuthRole } from "@/app/hooks/useAuthRole";
import {
  createDashboardUser,
  deleteUserAccount,
  disableDashboardUser,
  enableDashboardUser,
  forceRefreshCurrentUserToken,
  updateUserRole,
  type UserRole,
} from "@/lib/adminUsers";

type UserTheme = "light" | "dark" | "system";

type UserRow = {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  phone: string;
  theme: UserTheme;
  notifications: {
    email: boolean;
    sms: boolean;
  };
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string;
  updatedBy?: string;
};

type CreateFormState = {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
};

const PAGE_SIZE = 100;

const emptyCreateForm: CreateFormState = {
  email: "",
  password: "",
  displayName: "",
  role: "staff",
};

function formatTimestamp(value?: Timestamp | null): string {
  if (!value) return "—";

  try {
    return value.toDate().toLocaleString();
  } catch {
    return "—";
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function isUserTheme(value: unknown): value is UserTheme {
  return value === "light" || value === "dark" || value === "system";
}

function normalizeUserRow(uid: string, data: Partial<UserRow>): UserRow {
  const notifications =
    data.notifications &&
    typeof data.notifications === "object" &&
    typeof data.notifications.email === "boolean" &&
    typeof data.notifications.sms === "boolean"
      ? data.notifications
      : { email: true, sms: false };

  return {
    uid,
    email: typeof data.email === "string" ? data.email : "",
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    role: data.role === "admin" ? "admin" : "staff",
    active: typeof data.active === "boolean" ? data.active : true,
    phone: typeof data.phone === "string" ? data.phone : "",
    theme: isUserTheme(data.theme) ? data.theme : "system",
    notifications,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : null,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
  };
}

function areUsersEqual(previous: UserRow[], next: UserRow[]): boolean {
  if (previous.length !== next.length) return false;

  for (let index = 0; index < previous.length; index += 1) {
    const a = previous[index];
    const b = next[index];

    if (!a || !b) return false;

    if (
      a.uid !== b.uid ||
      a.email !== b.email ||
      a.displayName !== b.displayName ||
      a.role !== b.role ||
      a.active !== b.active ||
      a.phone !== b.phone ||
      a.theme !== b.theme ||
      a.createdBy !== b.createdBy ||
      a.updatedBy !== b.updatedBy ||
      a.notifications.email !== b.notifications.email ||
      a.notifications.sms !== b.notifications.sms ||
      a.createdAt?.seconds !== b.createdAt?.seconds ||
      a.updatedAt?.seconds !== b.updatedAt?.seconds
    ) {
      return false;
    }
  }

  return true;
}

function mergeUsers(previous: UserRow[], incoming: UserRow[]): UserRow[] {
  const map = new Map<string, UserRow>();

  for (const user of previous) {
    map.set(user.uid, user);
  }

  for (const user of incoming) {
    map.set(user.uid, user);
  }

  return Array.from(map.values()).sort((a, b) => {
    const aSeconds = a.createdAt?.seconds ?? 0;
    const bSeconds = b.createdAt?.seconds ?? 0;
    return bSeconds - aSeconds;
  });
}

export default function UsersPage() {
  const { loading: authLoading, isAdmin } = useAuthRole();

  const currentUid = auth.currentUser?.uid ?? "";

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "disabled"
  >("all");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(emptyCreateForm);
  const [creatingUser, setCreatingUser] = useState(false);

  const [busyUid, setBusyUid] = useState<string | null>(null);

  const baseUsersQuery = useMemo(() => {
    return query(
      collection(db, "users"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAdmin) {
      unstable_batchedUpdates(() => {
        setUsers([]);
        setLoadingUsers(false);
        setLastDoc(null);
        setHasMore(false);
      });
      return;
    }

    setLoadingUsers(true);

    const unsubscribe = onSnapshot(
      baseUsersQuery,
      (snapshot) => {
        const nextRows = snapshot.docs.map((docSnap) =>
          normalizeUserRow(docSnap.id, docSnap.data() as Partial<UserRow>)
        );

        unstable_batchedUpdates(() => {
          setUsers((previous) =>
            areUsersEqual(previous.slice(0, PAGE_SIZE), nextRows)
              ? previous
              : mergeUsers(previous.length > PAGE_SIZE ? previous : [], nextRows)
          );

          setLastDoc(snapshot.docs.at(-1) ?? null);
          setHasMore(snapshot.docs.length === PAGE_SIZE);
          setLoadingUsers(false);
        });
      },
      (error: unknown) => {
        console.error("Users snapshot error:", error);
        toast.error(getErrorMessage(error, "Failed to sync users."));

        unstable_batchedUpdates(() => {
          setLoadingUsers(false);
          setHasMore(false);
        });
      }
    );

    return () => unsubscribe();
  }, [authLoading, isAdmin, baseUsersQuery]);

  async function loadMoreUsers() {
    if (!isAdmin || !lastDoc || loadingMore) return;

    try {
      setLoadingMore(true);

      const nextQuery = query(
        collection(db, "users"),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(nextQuery);

      const nextRows = snapshot.docs.map((docSnap) =>
        normalizeUserRow(docSnap.id, docSnap.data() as Partial<UserRow>)
      );

      unstable_batchedUpdates(() => {
        setUsers((previous) => mergeUsers(previous, nextRows));
        setLastDoc(snapshot.docs.at(-1) ?? lastDoc);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      });
    } catch (error: unknown) {
      console.error("Load more users error:", error);
      toast.error(getErrorMessage(error, "Failed to load more users."));
    } finally {
      setLoadingMore(false);
    }
  }

  const filteredUsers = useMemo<UserRow[]>(() => {
    const needle = search.toLowerCase();

    return users.filter((user) => {
      if (needle) {
        const matchesSearch =
          user.email.toLowerCase().includes(needle) ||
          user.displayName.toLowerCase().includes(needle) ||
          user.uid.toLowerCase().includes(needle) ||
          user.phone.toLowerCase().includes(needle);

        if (!matchesSearch) return false;
      }

      if (roleFilter !== "all" && user.role !== roleFilter) return false;

      if (
        statusFilter !== "all" &&
        (statusFilter === "active" ? !user.active : user.active)
      ) {
        return false;
      }

      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    let admins = 0;
    let staff = 0;
    let active = 0;
    let disabled = 0;

    for (const user of users) {
      if (user.role === "admin") admins += 1;
      if (user.role === "staff") staff += 1;
      if (user.active) active += 1;
      else disabled += 1;
    }

    return {
      total: users.length,
      admins,
      staff,
      active,
      disabled,
    };
  }, [users]);

  async function handleCreateUser() {
    const email = createForm.email.trim();
    const password = createForm.password;
    const displayName = createForm.displayName.trim();
    const role = createForm.role;

    if (!email || !password || !displayName) {
      toast.error("Email, password, and display name are required.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    try {
      setCreatingUser(true);

      await createDashboardUser({
        email,
        password,
        displayName,
        role,
      });

      toast.success("User created.");
      setCreateForm(emptyCreateForm);
      setShowCreateForm(false);
    } catch (error: unknown) {
      console.error("Create user error:", error);
      toast.error(getErrorMessage(error, "Failed to create user."));
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleRoleChange(user: UserRow, nextRole: UserRole) {
    if (user.role === nextRole) return;

    if (user.uid === currentUid) {
      toast.error("You cannot change your own role.");
      return;
    }

    const confirmed = window.confirm(
      `Change ${user.email || user.uid} to ${nextRole}?`
    );

    if (!confirmed) return;

    const previousUsers = users;

    try {
      setBusyUid(user.uid);

      setUsers((current) =>
        current.map((row) =>
          row.uid === user.uid ? { ...row, role: nextRole } : row
        )
      );

      await updateUserRole({ uid: user.uid, role: nextRole });
      await forceRefreshCurrentUserToken();

      toast.success("Role updated.");
    } catch (error: unknown) {
      setUsers(previousUsers);
      console.error("Update role error:", error);
      toast.error(getErrorMessage(error, "Failed to update role."));
    } finally {
      setBusyUid(null);
    }
  }

  async function handleToggleActive(user: UserRow) {
    if (user.uid === currentUid) {
      toast.error("You cannot disable or enable your own account here.");
      return;
    }

    const actionText = user.active ? "disable" : "enable";
    const nextActive = !user.active;

    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} ${user.email || user.uid}?`
    );

    if (!confirmed) return;

    const previousUsers = users;

    try {
      setBusyUid(user.uid);

      setUsers((current) =>
        current.map((row) =>
          row.uid === user.uid ? { ...row, active: nextActive } : row
        )
      );

      if (user.active) {
        await disableDashboardUser({ uid: user.uid });
        toast.success("User disabled.");
      } else {
        await enableDashboardUser({ uid: user.uid });
        toast.success("User enabled.");
      }
    } catch (error: unknown) {
      setUsers(previousUsers);
      console.error("Toggle active error:", error);
      toast.error(getErrorMessage(error, `Failed to ${actionText} user.`));
    } finally {
      setBusyUid(null);
    }
  }

  async function handleDeleteUser(user: UserRow) {
    if (user.uid === currentUid) {
      toast.error("You cannot delete your own account.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${user.email || user.uid}?\n\nThis removes the Auth account and deletes the Firestore user document.`
    );

    if (!confirmed) return;

    const previousUsers = users;

    try {
      setBusyUid(user.uid);

      setUsers((current) => current.filter((row) => row.uid !== user.uid));

      await deleteUserAccount({ uid: user.uid });

      toast.success("User deleted.");
    } catch (error: unknown) {
      setUsers(previousUsers);
      console.error("Delete user error:", error);
      toast.error(getErrorMessage(error, "Failed to delete user."));
    } finally {
      setBusyUid(null);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        <div className="max-w-7xl">
          <div className="flex items-center gap-3 text-zinc-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading access...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        <div className="max-w-7xl">
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
            <h1 className="text-2xl font-semibold">Admin access required</h1>
            <p className="mt-2 text-sm text-zinc-300">
              You do not have permission to manage users.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <div className="max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
              <Users className="h-8 w-8" />
              Users
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Manage accounts, roles, access, and account status.
            </p>
          </div>

          <button
            type="button"
            aria-label={showCreateForm ? "Close create user form" : "Open create user form"}
            onClick={() => setShowCreateForm((previous) => !previous)}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium transition hover:bg-white/15"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? "Close Create User" : "Create User"}
          </button>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-5">
          <Stat label="Total" value={stats.total} />
          <Stat label="Admins" value={stats.admins} />
          <Stat label="Staff" value={stats.staff} />
          <Stat label="Active" value={stats.active} />
          <Stat label="Disabled" value={stats.disabled} />
        </div>

        {showCreateForm ? (
          <div className="mb-6 rounded-3xl border border-white/10 bg-zinc-950 p-6">
            <div className="mb-4 flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Create User</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FormField label="Display Name" id="create-display-name">
                <input
                  id="create-display-name"
                  type="text"
                  value={createForm.displayName}
                  onChange={(event) =>
                    setCreateForm((previous) => ({
                      ...previous,
                      displayName: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none transition focus:border-white/30"
                  placeholder="Jane Smith"
                  autoComplete="name"
                />
              </FormField>

              <FormField label="Email" id="create-email">
                <input
                  id="create-email"
                  type="email"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((previous) => ({
                      ...previous,
                      email: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none transition focus:border-white/30"
                  placeholder="jane@example.com"
                  autoComplete="email"
                />
              </FormField>

              <FormField label="Password" id="create-password">
                <input
                  id="create-password"
                  type="password"
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((previous) => ({
                      ...previous,
                      password: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none transition focus:border-white/30"
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                />
              </FormField>

              <FormField label="Role" id="create-role">
                <select
  id="create-role"
  title="Select user role"
                  value={createForm.role}
                  onChange={(event) =>
                    setCreateForm((previous) => ({
                      ...previous,
                      role: event.target.value as UserRole,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none transition focus:border-white/30"
                >
                  <option value="staff">staff</option>
                  <option value="admin">admin</option>
                </select>
              </FormField>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                aria-label="Create dashboard user"
                onClick={() => void handleCreateUser()}
                disabled={creatingUser}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingUser ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create User
              </button>

              <button
                type="button"
                aria-label="Cancel creating user"
                onClick={() => {
                  setCreateForm(emptyCreateForm);
                  setShowCreateForm(false);
                }}
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium transition hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="mb-6 rounded-3xl border border-white/10 bg-zinc-950 p-5">
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label
                htmlFor="user-search"
                className="mb-2 block text-sm text-zinc-400"
              >
                Search
              </label>

              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black px-4 py-3">
                <Search className="h-4 w-4 text-zinc-500" />
                <input
                  id="user-search"
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search by email, name, phone, or UID"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                  autoComplete="off"
                />
              </div>
            </div>

            <FormField label="Role" id="role-filter">
              <select
  id="role-filter"
  title="Filter users by role"
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value as "all" | UserRole)
                }
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none"
              >
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </FormField>

            <FormField label="Status" id="status-filter">
              <select
  id="status-filter"
  title="Filter users by account status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as "all" | "active" | "disabled"
                  )
                }
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </FormField>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950">
          <div className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/95 px-5 py-4 backdrop-blur">
            <h2 className="text-lg font-semibold">User Directory</h2>
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
            <div className="px-5 py-10 text-sm text-zinc-400">
              No users found.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filteredUsers.map((user) => {
                const isBusy = busyUid === user.uid;
                const isSelf = currentUid === user.uid;
                const userLabel = user.email || user.uid;

                return (
                  <div
                    key={user.uid}
                    className="grid gap-4 px-5 py-5 xl:grid-cols-[2fr_1fr_1fr_1.2fr]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold">
                          {user.displayName || "Unnamed User"}
                        </p>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            user.role === "admin"
                              ? "bg-blue-500/15 text-blue-300"
                              : "bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          {user.role}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            user.active
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-red-500/15 text-red-300"
                          }`}
                        >
                          {user.active ? "active" : "disabled"}
                        </span>

                        {isSelf ? (
                          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
                            you
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 break-all text-sm text-zinc-300">
                        {user.email || "—"}
                      </p>

                      <p className="mt-1 break-all text-xs text-zinc-500">
                        UID: {user.uid}
                      </p>

                      <div className="mt-3 grid gap-2 text-xs text-zinc-500 md:grid-cols-2">
                        <p>Created: {formatTimestamp(user.createdAt)}</p>
                        <p>Updated: {formatTimestamp(user.updatedAt)}</p>
                        <p>Theme: {user.theme}</p>
                        <p>Phone: {user.phone || "—"}</p>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                        Role
                      </p>

                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-zinc-500" />

                        <label htmlFor={`role-${user.uid}`} className="sr-only">
                          Change role for {userLabel}
                        </label>

                        <select
                          id={`role-${user.uid}`}
                          value={user.role}
                          disabled={isBusy || isSelf}
                          onChange={(event) =>
                            void handleRoleChange(
                              user,
                              event.target.value as UserRole
                            )
                          }
                          className="w-full rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm outline-none disabled:opacity-60"
                        >
                          <option value="staff">staff</option>
                          <option value="admin">admin</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                        Account
                      </p>

                      <button
                        type="button"
                        aria-label={
                          user.active
                            ? `Disable ${userLabel}`
                            : `Enable ${userLabel}`
                        }
                        title={
                          isSelf
                            ? "You cannot disable or enable your own account."
                            : user.active
                              ? "Disable user"
                              : "Enable user"
                        }
                        disabled={isBusy || isSelf}
                        onClick={() => void handleToggleActive(user)}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          user.active
                            ? "border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/15"
                            : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : user.active ? (
                          <UserMinus className="h-4 w-4" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                        {user.active ? "Disable" : "Enable"}
                      </button>
                    </div>

                    <div>
                      <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                        Actions
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          aria-label={`Toggle role for ${userLabel}`}
                          title={
                            isSelf
                              ? "You cannot change your own role."
                              : "Toggle user role"
                          }
                          disabled={isBusy || isSelf}
                          onClick={() =>
                            void handleRoleChange(
                              user,
                              user.role === "admin" ? "staff" : "admin"
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2.5 text-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserCog className="h-4 w-4" />
                          )}
                          Toggle Role
                        </button>

                        <button
                          type="button"
                          aria-label={`Delete ${userLabel}`}
                          disabled={isBusy || isSelf}
                          onClick={() => void handleDeleteUser(user)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                          title={
                            isSelf
                              ? "You cannot delete your own account."
                              : "Delete user"
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>

                      {isSelf ? (
                        <p className="mt-2 text-xs text-zinc-500">
                          Self-delete, self-disable, and self-role-change are
                          blocked.
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loadingUsers && hasMore ? (
            <div className="border-t border-white/10 px-5 py-5">
              <button
                type="button"
                aria-label="Load more users"
                disabled={loadingMore}
                onClick={() => void loadMoreUsers()}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
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
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500">
          <RefreshCw className="h-3.5 w-3.5" />
          Role changes may require the affected user to sign out and back in.
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-5">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}