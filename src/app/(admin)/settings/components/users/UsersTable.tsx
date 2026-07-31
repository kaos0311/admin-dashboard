import { typography } from "@/theme";

import type {
  AdminUser,
  UserRole,
  UserStatus,
} from "../../settings-types";

import { UserRow } from "./UserRow";

type UsersTableProps = {
  users: AdminUser[];
  saving: boolean;

  onUpdateRole: (
    userId: string,
    role: UserRole
  ) => Promise<void>;

  onUpdateStatus: (
    userId: string,
    status: UserStatus
  ) => Promise<void>;

  onDeleteUser: (
    userId: string
  ) => Promise<void>;
};

export function UsersTable({
  users,
  saving,
  onUpdateRole,
  onUpdateStatus,
  onDeleteUser,
}: UsersTableProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 py-12 text-center">
        <p className={typography.cardTitle}>
          No users found
        </p>

        <p
          className={`mt-2 text-sm ${typography.bodyMuted}`}
        >
          Create an employee login above.
          Firebase Auth, custom claims, and the
          Firestore user document must all match.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-white/10">
      <table className="w-full min-w-[900px] border-collapse text-left">
        <thead
          className={`bg-white/[0.045] text-xs uppercase tracking-[0.16em] ${typography.caption}`}
        >
          <tr>
            <th className="px-4 py-3 font-semibold">
              User
            </th>

            <th className="px-4 py-3 font-semibold">
              Role
            </th>

            <th className="px-4 py-3 font-semibold">
              Status
            </th>

            <th className="px-4 py-3 font-semibold">
              Access
            </th>

            <th className="px-4 py-3 text-right font-semibold">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {users.map((user) => {
            const userId =
              user.uid || user.id;

            return (
              <UserRow
                key={userId}
                user={user}
                saving={saving}
                onUpdateRole={onUpdateRole}
                onUpdateStatus={
                  onUpdateStatus
                }
                onDeleteUser={onDeleteUser}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}