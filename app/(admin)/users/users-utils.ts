import { Timestamp } from "firebase/firestore";
import type { UserRow, UserTheme } from "./users-types";

export function formatTimestamp(value?: Timestamp | null): string {
  if (!value) return "—";

  try {
    return value.toDate().toLocaleString();
  } catch {
    return "—";
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function isUserTheme(value: unknown): value is UserTheme {
  return value === "light" || value === "dark" || value === "system";
}

export function normalizeUserRow(
  uid: string,
  data: Partial<UserRow>
): UserRow {
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

export function areUsersEqual(
  previous: UserRow[],
  next: UserRow[]
): boolean {
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

export function mergeUsers(previous: UserRow[], incoming: UserRow[]): UserRow[] {
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