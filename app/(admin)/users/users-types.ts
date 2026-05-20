import type { Timestamp } from "firebase/firestore";
import type { UserRole } from "@/lib/adminUsers";

export type UserTheme = "light" | "dark" | "system";

export type UserRow = {
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

export type CreateFormState = {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
};

export type UserStats = {
  total: number;
  admins: number;
  staff: number;
  active: number;
  disabled: number;
};

export const PAGE_SIZE = 100;

export const emptyCreateForm: CreateFormState = {
  email: "",
  password: "",
  displayName: "",
  role: "staff",
};