"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getIdTokenResult,
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export type UserRole = "admin" | "staff" | null;

type UseAuthRoleResult = {
  user: User | null;
  role: UserRole;
  loading: boolean;
  error: string;
  active: boolean | null;

  isAdmin: boolean;
  isStaff: boolean;
  isAdminOrStaff: boolean;

  canAccessDashboard: boolean;
  canUploadReports: boolean;
  canRefreshImports: boolean;
  canDeleteImports: boolean;
  canReadAuditLogs: boolean;
};

function parseRole(value: unknown): UserRole {
  if (value === "admin" || value === "staff") return value;
  return null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "Unable to verify user role.";
}

export function useAuthRole(): UseAuthRoleResult {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [active, setActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (cancelled) return;

      setLoading(true);
      setError("");

      if (!currentUser) {
        setUser(null);
        setRole(null);
        setActive(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      try {
        let resolvedRole: UserRole = null;
        let resolvedActive: boolean | null = null;

        try {
          const tokenResult = await getIdTokenResult(currentUser, true);
          resolvedRole = parseRole(tokenResult.claims.role);
        } catch (tokenError) {
          console.error("AUTH TOKEN ROLE ERROR:", tokenError);
        }

        try {
          const userSnap = await getDoc(doc(db, "users", currentUser.uid));

          if (userSnap.exists()) {
            const data = userSnap.data() as Record<string, unknown>;

            resolvedActive = data.active !== false;

            if (data.active === false) {
              await signOut(auth);

              if (!cancelled) {
                setUser(null);
                setRole(null);
                setActive(false);
                setError("This account has been disabled.");
              }

              return;
            }

            const dbRole = parseRole(data.role);

            if (dbRole) {
              resolvedRole = dbRole;
            }
          } else {
            resolvedActive = true;
          }
        } catch (userDocError) {
          console.error("AUTH USER DOC ROLE ERROR:", userDocError);
        }

        if (!cancelled) {
          setRole(resolvedRole);
          setActive(resolvedActive);
        }
      } catch (authRoleError: unknown) {
        console.error("AUTH ROLE ERROR:", authRoleError);

        if (!cancelled) {
          setRole(null);
          setActive(null);
          setError(getErrorMessage(authRoleError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return useMemo<UseAuthRoleResult>(() => {
    const isAdmin = role === "admin";
    const isStaff = role === "staff";
    const isAdminOrStaff = isAdmin || isStaff;
    const isActiveUser = active !== false;

    const canAccessDashboard = Boolean(user && isActiveUser && isAdminOrStaff);

    return {
      user,
      role,
      loading,
      error,
      active,

      isAdmin,
      isStaff,
      isAdminOrStaff,

      canAccessDashboard,
      canUploadReports: canAccessDashboard,
      canRefreshImports: canAccessDashboard,
      canDeleteImports: canAccessDashboard && isAdmin,
      canReadAuditLogs: canAccessDashboard && isAdmin,
    };
  }, [user, role, loading, error, active]);
}