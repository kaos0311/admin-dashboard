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
  DEFAULT_APP_SETTINGS,
  DEFAULT_USER_DRAFT,
  SETTINGS_APP_DOC_ID,
  SETTINGS_COLLECTION,
  USERS_COLLECTION,
} from "../settings-constants";

import type {
  AdminUser,
  AppSettings,
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

  loading: boolean;
  saving: boolean;

  message: SettingsMessage | null;

  saveSettings: () => Promise<void>;
  resetSettings: () => void;

  createUserDraft: () => Promise<void>;

  updateUserRole: (
    userId: string,
    role: UserRole
  ) => Promise<void>;

  updateUserStatus: (
    userId: string,
    status: UserStatus
  ) => Promise<void>;
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
      () => {
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
      () => {
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
    setSaving(true);

    try {
      const currentUser = auth.currentUser;

      await setDoc(
        doc(db, SETTINGS_COLLECTION, SETTINGS_APP_DOC_ID),
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
    } catch {
      setMessage({
        type: "error",
        text: "Failed to save settings.",
      });
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const resetSettings = useCallback(() => {
    setSettings(savedSettings);

    setMessage({
      type: "info",
      text: "Unsaved changes were reset.",
    });
  }, [savedSettings]);

  const createUserDraft = useCallback(async () => {
    const email = userDraft.email.trim().toLowerCase();
    const displayName = userDraft.displayName.trim();

    if (!validateEmail(email)) {
      setMessage({
        type: "error",
        text: "Enter a valid email address.",
      });

      return;
    }

    setSaving(true);

    try {
      const userId = email
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();

      await setDoc(
        doc(db, USERS_COLLECTION, userId),
        {
          uid: userId,
          email,
          displayName,
          role: userDraft.role,
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      setUserDraft(DEFAULT_USER_DRAFT);

      setMessage({
        type: "success",
        text: "User document created.",
      });
    } catch {
      setMessage({
        type: "error",
        text: "Unable to create user document.",
      });
    } finally {
      setSaving(false);
    }
  }, [userDraft]);

  const updateUserRole = useCallback(
    async (
      userId: string,
      role: UserRole
    ) => {
      await updateDoc(
        doc(db, USERS_COLLECTION, userId),
        {
          role,
          updatedAt: serverTimestamp(),
        }
      );
    },
    []
  );

  const updateUserStatus = useCallback(
    async (
      userId: string,
      status: UserStatus
    ) => {
      await updateDoc(
        doc(db, USERS_COLLECTION, userId),
        {
          status,
          updatedAt: serverTimestamp(),
        }
      );
    },
    []
  );

  return {
    settings,
    savedSettings,
    setSettings,

    users,

    userDraft,
    setUserDraft,

    loading,
    saving,

    message,

    saveSettings,
    resetSettings,

    createUserDraft,

    updateUserRole,
    updateUserStatus,
  };
}