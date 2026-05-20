"use client";

import { Loader2, Plus, UserPlus } from "lucide-react";

import type { UserRole } from "@/lib/adminUsers";
import type { CreateFormState } from "../users-types";
import { SelectInput } from "./SelectInput";
import { TextInput } from "./TextInput";

type CreateUserPanelProps = {
  createForm: CreateFormState;
  setCreateForm: React.Dispatch<React.SetStateAction<CreateFormState>>;
  creatingUser: boolean;
  onCreateUser: () => void;
  onCancel: () => void;
};

export function CreateUserPanel({
  createForm,
  setCreateForm,
  creatingUser,
  onCreateUser,
  onCancel,
}: CreateUserPanelProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="mb-4 flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-sky-300" />
        <h2 className="text-xl font-semibold text-white">Create User</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TextInput
          label="Display Name"
          value={createForm.displayName}
          onChange={(value) =>
            setCreateForm((previous) => ({
              ...previous,
              displayName: value,
            }))
          }
          placeholder="Jane Smith"
          autoComplete="name"
        />

        <TextInput
          label="Email"
          type="email"
          value={createForm.email}
          onChange={(value) =>
            setCreateForm((previous) => ({
              ...previous,
              email: value,
            }))
          }
          placeholder="jane@example.com"
          autoComplete="email"
        />

        <TextInput
          label="Password"
          type="password"
          value={createForm.password}
          onChange={(value) =>
            setCreateForm((previous) => ({
              ...previous,
              password: value,
            }))
          }
          placeholder="Minimum 6 characters"
          autoComplete="new-password"
        />

        <SelectInput
          label="Role"
          value={createForm.role}
          onChange={(value) =>
            setCreateForm((previous) => ({
              ...previous,
              role: value as UserRole,
            }))
          }
          options={[
            { value: "staff", label: "staff" },
            { value: "admin", label: "admin" },
          ]}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          title="Create dashboard user"
          aria-label="Create dashboard user"
          onClick={onCreateUser}
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
          title="Cancel creating user"
          aria-label="Cancel creating user"
          onClick={onCancel}
          className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}