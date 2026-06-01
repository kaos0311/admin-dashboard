import type { Dispatch, SetStateAction } from "react";
import type {
  AdminUser,
  UserDraft,
  UserRole,
  UserStatus,
} from "../../settings-types";
import { glassPanel } from "../../styles/glass";
import { InfoCard } from "../shared/InfoCard";
import { SectionHeader } from "../shared/SectionHeader";
import { UserCreateCard } from "./UserCreateCard";
import { UsersTable } from "./UsersTable";

type UsersTabProps = {
  users: AdminUser[];
  userDraft: UserDraft;
  setUserDraft: Dispatch<SetStateAction<UserDraft>>;
  onCreateUser: () => Promise<void>;
  onUpdateRole: (userId: string, role: UserRole) => Promise<void>;
  onUpdateStatus: (userId: string, status: UserStatus) => Promise<void>;
};

export function UsersTab({
  users,
  userDraft,
  setUserDraft,
  onCreateUser,
  onUpdateRole,
  onUpdateStatus,
}: UsersTabProps) {
  return (
    <section className={`${glassPanel} p-5`}>
      <SectionHeader
        eyebrow="Users"
        title="User Access"
        description="Manage app user documents, roles, and status. Real access still depends on Firebase Auth and custom claims, because apparently one lock was too easy."
      />

      <div className="mt-6 grid gap-4">
        <UserCreateCard
          userDraft={userDraft}
          setUserDraft={setUserDraft}
          onCreateUser={onCreateUser}
        />

        <InfoCard title="Current Users">
          <UsersTable
            users={users}
            onUpdateRole={onUpdateRole}
            onUpdateStatus={onUpdateStatus}
          />
        </InfoCard>
      </div>
    </section>
  );
}


