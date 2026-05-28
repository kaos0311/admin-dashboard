import type { AdminUser, UserRole, UserStatus } from "../../settings-types";
import { UserRow } from "./UserRow";

type UsersTableProps = {
  users: AdminUser[];
  onUpdateRole: (userId: string, role: UserRole) => Promise<void>;
  onUpdateStatus: (userId: string, status: UserStatus) => Promise<void>;
};

export function UsersTable({
  users,
  onUpdateRole,
  onUpdateStatus,
}: UsersTableProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 py-12 text-center">
        <p className="font-semibold text-white">No users found</p>
        <p className="mt-2 text-sm text-slate-400">
          Create a user document above. Then make sure Firebase Auth and custom
          claims match, because Firestore documents alone are not magic keys.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10">
      <table className="w-full border-collapse text-left">
        <thead className="bg-white/[0.045] text-xs uppercase tracking-[0.16em] text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">User</th>
            <th className="px-4 py-3 font-semibold">Role</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Access</th>
          </tr>
        </thead>

        <tbody>
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onUpdateRole={onUpdateRole}
              onUpdateStatus={onUpdateStatus}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
