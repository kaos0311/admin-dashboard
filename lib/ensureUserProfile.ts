import type { User } from "firebase/auth";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type DashboardUserProfile = {
  uid: string;
  email: string;
  displayName: string;
  role: "admin" | "staff";
  active: boolean;

  phone: string;

  notifications: {
    email: boolean;
    sms: boolean;
  };

  theme: "light" | "dark" | "system";

  createdAt?: unknown;
  updatedAt?: unknown;
};

function normalizeString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export async function ensureUserProfile(
  user: User
): Promise<void> {
  if (!user.uid) {
    throw new Error(
      "Cannot create user profile without UID."
    );
  }

  const userRef = doc(db, "users", user.uid);

  const snapshot = await getDoc(userRef);

  const email = normalizeString(user.email);

  const displayName = normalizeString(
    user.displayName
  );

  /*
  |--------------------------------------------------------------------------
  | FIRST-TIME USER CREATION
  |--------------------------------------------------------------------------
  */

  if (!snapshot.exists()) {
    const profile: DashboardUserProfile = {
      uid: user.uid,

      email,
      displayName,

      role: "staff",
      active: true,

      phone: "",

      notifications: {
        email: true,
        sms: false,
      },

      theme: "dark",

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, profile);

    return;
  }

  /*
  |--------------------------------------------------------------------------
  | EXISTING USER UPDATE
  |--------------------------------------------------------------------------
  */

  const existingData = snapshot.data() as Partial<DashboardUserProfile>;

  await setDoc(
    userRef,
    {
      uid: user.uid,

      email,
      displayName,

      /*
      |--------------------------------------------------------------------------
      | PRESERVE EXISTING ROLE/ACTIVE STATUS
      |--------------------------------------------------------------------------
      */

      role:
        existingData.role === "admin"
          ? "admin"
          : "staff",

      active:
        typeof existingData.active ===
        "boolean"
          ? existingData.active
          : true,

      /*
      |--------------------------------------------------------------------------
      | PRESERVE OPTIONAL SETTINGS
      |--------------------------------------------------------------------------
      */

      phone: normalizeString(
        existingData.phone
      ),

      notifications: {
        email:
          existingData.notifications?.email ??
          true,

        sms:
          existingData.notifications?.sms ??
          false,
      },

      theme:
        existingData.theme === "light" ||
        existingData.theme === "system"
          ? existingData.theme
          : "dark",

      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}