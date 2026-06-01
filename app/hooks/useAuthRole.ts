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
  return value === "admin" || value === "staff" ? value : null;
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
      setLoading(true);
      setError("");

      if (!currentUser) {
        setUser(null);
        setRole(null);
        setActive(null);
        setLoading(false);
        return;
      }

      try {
        setUser(currentUser);

        let resolvedRole: UserRole = null;
        let resolvedActive: boolean | null = true;

        const tokenResult = await getIdTokenResult(currentUser, true);
        resolvedRole = parseRole(tokenResult.claims.role);

        const userSnap = await getDoc(doc(db, "users", currentUser.uid));

        if (userSnap.exists()) {
          const data = userSnap.data() as Record<string, unknown>;

          resolvedActive = data.active !== false;

          const dbRole = parseRole(data.role);
          if (dbRole) resolvedRole = dbRole;

          console.log("AUTH ROLE DEBUG:", {
            uid: currentUser.uid,
            email: currentUser.email,
            userDocExists: true,
            userDoc: data,
            tokenClaims: tokenResult.claims,
            resolvedRole,
            resolvedActive,
          });

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
        } else {
          console.warn("AUTH ROLE DEBUG: user document missing", {
            uid: currentUser.uid,
            email: currentUser.email,
            tokenClaims: tokenResult.claims,
          });
        }

        if (!cancelled) {
          setRole(resolvedRole);
          setActive(resolvedActive);
        }
      } catch (authRoleError) {
        console.error("AUTH ROLE ERROR:", authRoleError);

        if (!cancelled) {
          setRole(null);
          setActive(null);
          setError(getErrorMessage(authRoleError));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return useMemo(() => {
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


