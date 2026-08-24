"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

import {
  createDashboardUser,
  deleteUserAccount,
  resetUserPassword,
  updateUserRole as updateDashboardUserRole,
} from "@/lib/adminUsers";

import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_USER_DRAFT,
  initialPasswordResetForm,
  SETTINGS_APP_DOC_ID,
  SETTINGS_COLLECTION,
  USERS_COLLECTION,
} from "../settings-constants";

import type {
  AdminUser,
  AppSettings,
  PasswordResetForm,
  SettingsMessage,
  UserDraft,
  UserRole,
  UserStatus,
} from "../settings-types";

import {
  normalizeAdminUser,
  normalizeAppSettings,
  validateEmail,
} from "../settings-utils";

type UseSettingsPageResult = {
  settings: AppSettings;
  savedSettings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;

  users: AdminUser[];

  userDraft: UserDraft;
  setUserDraft: Dispatch<SetStateAction<UserDraft>>;

  passwordResetForm: PasswordResetForm;
  setPasswordResetForm: Dispatch<SetStateAction<PasswordResetForm>>;

  loading: boolean;
  saving: boolean;

  message: SettingsMessage | null;

  saveSettings: () => Promise<void>;
  resetSettings: () => void;

  createUserDraft: () => Promise<void>;
  resetEmployeePassword: () => Promise<void>;

  updateUserRole: (
    userId: string,
    role: UserRole
  ) => Promise<void>;

  updateUserStatus: (
    userId: string,
    status: UserStatus
  ) => Promise<void>;

  deleteUser: (userId: string) => Promise<void>;
};

export function useSettingsPage(): UseSettingsPageResult {
  const [settings, setSettings] = useState<AppSettings>(
    DEFAULT_APP_SETTINGS
  );

  const [savedSettings, setSavedSettings] =
    useState<AppSettings>(DEFAULT_APP_SETTINGS);

  const [users, setUsers] = useState<AdminUser[]>([]);

  const [userDraft, setUserDraft] =
    useState<UserDraft>(DEFAULT_USER_DRAFT);

  const [passwordResetForm, setPasswordResetForm] =
    useState<PasswordResetForm>(initialPasswordResetForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] =
    useState<SettingsMessage | null>(null);

  useEffect(() => {
    const settingsRef = doc(
      db,
      SETTINGS_COLLECTION,
      SETTINGS_APP_DOC_ID
    );

    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        const normalized = normalizeAppSettings(
          snapshot.exists()
            ? (snapshot.data() as Record<string, unknown>)
            : undefined
        );

        setSettings(normalized);
        setSavedSettings(normalized);
        setLoading(false);
      },
      (error) => {
        console.error(
          "[Settings] Unable to load settings",
          error
        );

        setSettings(DEFAULT_APP_SETTINGS);
        setSavedSettings(DEFAULT_APP_SETTINGS);

        setMessage({
          type: "error",
          text: "Unable to load settings.",
        });

        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const usersQuery = query(
      collection(db, USERS_COLLECTION),
      orderBy("email", "asc")
    );

    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const normalizedUsers = snapshot.docs.map((docSnap) =>
          normalizeAdminUser(
            docSnap.id,
            docSnap.data() as Record<string, unknown>
          )
        );

        setUsers(normalizedUsers);
      },
      (error) => {
        console.error(
          "[Settings] Unable to load users",
          error
        );

        setUsers([]);

        setMessage({
          type: "error",
          text: "Unable to load users.",
        });
      }
    );

    return unsubscribe;
  }, []);

  const saveSettings = useCallback(async () => {
    if (saving) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const currentUser = auth.currentUser;

      await setDoc(
        doc(
          db,
          SETTINGS_COLLECTION,
          SETTINGS_APP_DOC_ID
        ),
        {
          ...settings,
          updatedAt: serverTimestamp(),
          updatedBy:
            currentUser?.email ??
            currentUser?.uid ??
            "unknown",
        },
        {
          merge: true,
        }
      );

      setSavedSettings(settings);

      setMessage({
        type: "success",
        text: "Settings saved successfully.",
      });
    } catch (error) {
      console.error(
        "[Settings] Failed to save settings",
        error
      );

      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to save settings.",
      });
    } finally {
      setSaving(false);
    }
  }, [saving, settings]);

  const resetSettings = useCallback(() => {
    if (saving) {
      return;
    }

    setSettings(savedSettings);

    setMessage({
      type: "info",
      text: "Unsaved changes were reset.",
    });
  }, [savedSettings, saving]);

  const createUserDraft = useCallback(async () => {
    if (saving) {
      return;
    }

    const email = userDraft.email.trim().toLowerCase();
    const displayName = userDraft.displayName.trim();
    const password = userDraft.password;

    setMessage(null);

    if (!displayName) {
      setMessage({
        type: "error",
        text: "Enter the employee display name.",
      });

      return;
    }

    if (!validateEmail(email)) {
      setMessage({
        type: "error",
        text: "Enter a valid email address.",
      });

      return;
    }

    if (password.length < 8) {
      setMessage({
        type: "error",
        text: "Temporary password must be at least 8 characters.",
      });

      return;
    }

    setSaving(true);

    try {
      await createDashboardUser({
        email,
        password,
        displayName,
        role: userDraft.role,
      });

      setUserDraft(DEFAULT_USER_DRAFT);

      setMessage({
        type: "success",
        text: "Employee login created.",
      });
    } catch (error) {
      console.error(
        "[Settings] Unable to create employee login",
        error
      );

      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to create employee login.",
      });
    } finally {
      setSaving(false);
    }
  }, [saving, userDraft]);

  const updateUserRole = useCallback(
    async (
      userId: string,
      role: UserRole
    ): Promise<void> => {
      if (saving) {
        return;
      }

      const uid = userId.trim();

      if (!uid) {
        setMessage({
          type: "error",
          text: "Unable to identify the employee account.",
        });

        return;
      }

      setSaving(true);
      setMessage(null);

      try {
        await updateDashboardUserRole({
          uid,
          role,
        });

        setMessage({
          type: "success",
          text: "Employee role updated.",
        });
      } catch (error) {
        console.error(
          "[Settings] Unable to update employee role",
          error
        );

        setMessage({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Unable to update employee role.",
        });
      } finally {
        setSaving(false);
      }
    },
    [saving]
  );

  const updateUserStatus = useCallback(
    async (
      userId: string,
      status: UserStatus
    ): Promise<void> => {
      if (saving) {
        return;
      }

      const uid = userId.trim();

      if (!uid) {
        setMessage({
          type: "error",
          text: "Unable to identify the employee account.",
        });

        return;
      }

      setSaving(true);
      setMessage(null);

      try {
        await updateDoc(
          doc(db, USERS_COLLECTION, uid),
          {
            status,
            updatedAt: serverTimestamp(),
          }
        );

        setMessage({
          type: "success",
          text: "Employee status updated.",
        });
      } catch (error) {
        console.error(
          "[Settings] Unable to update employee status",
          error
        );

        setMessage({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Unable to update employee status.",
        });
      } finally {
        setSaving(false);
      }
    },
    [saving]
  );

  const resetEmployeePassword = useCallback(async () => {
    if (saving) {
      return;
    }

    const uid = passwordResetForm.uid.trim();
    const newPassword =
      passwordResetForm.newPassword;

    setMessage(null);

    if (!uid) {
      setMessage({
        type: "error",
        text: "Select an employee before resetting a password.",
      });

      return;
    }

    if (newPassword.length < 8) {
      setMessage({
        type: "error",
        text: "Temporary password must be at least 8 characters.",
      });

      return;
    }

    setSaving(true);

    try {
      await resetUserPassword({
        uid,
        newPassword,
      });

      setPasswordResetForm(
        initialPasswordResetForm
      );

      setMessage({
        type: "success",
        text: "Employee password was reset.",
      });
    } catch (error) {
      console.error(
        "[Settings] Unable to reset employee password",
        error
      );

      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to reset employee password.",
      });
    } finally {
      setSaving(false);
    }
  }, [passwordResetForm, saving]);

  const deleteUser = useCallback(
    async (userId: string): Promise<void> => {
      if (saving) {
        return;
      }

      const uid = userId.trim();
      const currentUser = auth.currentUser;

      if (!uid) {
        setMessage({
          type: "error",
          text: "Unable to identify the employee account.",
        });

        return;
      }

      if (currentUser?.uid === uid) {
        setMessage({
          type: "error",
          text: "You cannot delete your own signed-in account.",
        });

        return;
      }

      setSaving(true);
      setMessage(null);

      try {
        await deleteUserAccount({
          uid,
        });

        setPasswordResetForm((current) =>
          current.uid === uid
            ? initialPasswordResetForm
            : current
        );

        setMessage({
          type: "success",
          text: "Employee account deleted.",
        });
      } catch (error) {
        console.error(
          "[Settings] Unable to delete employee account",
          error
        );

        setMessage({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Unable to delete employee account.",
        });
      } finally {
        setSaving(false);
      }
    },
    [saving]
  );

  return {
    settings,
    savedSettings,
    setSettings,

    users,

    userDraft,
    setUserDraft,

    passwordResetForm,
    setPasswordResetForm,

    loading,
    saving,

    message,

    saveSettings,
    resetSettings,

    createUserDraft,
    resetEmployeePassword,

    updateUserRole,
    updateUserStatus,
    deleteUser,
  };
}