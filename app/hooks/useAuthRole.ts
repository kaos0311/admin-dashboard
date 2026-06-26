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

export type UserRole = "admin" | "staff" | "tank" | null;

type UseAuthRoleResult = {
  user: User | null;
  role: UserRole;
  loading: boolean;
  error: string;
  active: boolean | null;
  isAdmin: boolean;
  isStaff: boolean;
  isTank: boolean;
  isAdminOrStaff: boolean;
  canAccessCommandCenter: boolean;
  canUploadReports: boolean;
  canRefreshImports: boolean;
  canDeleteImports: boolean;
  canReadAuditLogs: boolean;
};

type CachedRoleState = {
  uid: string;
  role: UserRole;
  active: boolean | null;
  checkedAt: number;
};

const ROLE_CACHE_TTL_MS = 60_000;

let roleCache: CachedRoleState | null = null;

function parseRole(value: unknown): UserRole {
  return value === "admin" || value === "staff" || value === "tank"
    ? value
    : null;
}

function getRoleFromUserRecord(data: Record<string, unknown>): UserRole {
  const dbRole = parseRole(data.role);
  if (dbRole) return dbRole;

  if (data.temporaryTankAccess === true) {
    const prevRole = parseRole(data.previousRole);
    if (prevRole === "admin" || prevRole === "tank") {
      return "tank";
    }
  }

  return null;
}

function mergeRoles(tokenRole: UserRole, dbRole: UserRole): UserRole {
  if (tokenRole === "admin" || dbRole === "admin") {
    return "admin";
  }

  if (tokenRole === "tank" || dbRole === "tank") {
    return "tank";
  }

  if (tokenRole === "staff" || dbRole === "staff") {
    return "staff";
  }

  return null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "Unable to verify user role.";
}

function clearAuthState(
  setUser: (value: User | null) => void,
  setRole: (value: UserRole) => void,
  setActive: (value: boolean | null) => void,
): void {
  setUser(null);
  setRole(null);
  setActive(null);
}

function getCachedRole(uid: string): CachedRoleState | null {
  if (!roleCache) return null;
  if (roleCache.uid !== uid) return null;

  const cacheAge = Date.now() - roleCache.checkedAt;

  return cacheAge <= ROLE_CACHE_TTL_MS ? roleCache : null;
}

function setCachedRole(uid: string, role: UserRole, active: boolean | null): void {
  roleCache = {
    uid,
    role,
    active,
    checkedAt: Date.now(),
  };
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
        roleCache = null;

        if (!cancelled) {
          clearAuthState(setUser, setRole, setActive);
          setLoading(false);
        }

        return;
      }

      setUser(currentUser);

      const cachedRole = getCachedRole(currentUser.uid);

      if (cachedRole) {
        if (!cancelled) {
          setRole(cachedRole.role);
          setActive(cachedRole.active);
          setLoading(false);
        }

        return;
      }

      try {
        let resolvedRole: UserRole = null;
        let resolvedActive: boolean | null = true;

        const tokenResult = await getIdTokenResult(currentUser, true);
        resolvedRole = parseRole(tokenResult.claims.role);

        const userSnap = await getDoc(doc(db, "users", currentUser.uid));

        if (userSnap.exists()) {
          const data = userSnap.data() as Record<string, unknown>;

          resolvedActive =
            data.active !== false &&
            data.disabled !== true &&
            data.deleted !== true;

          const dbRole = getRoleFromUserRecord(data);
          resolvedRole = mergeRoles(resolvedRole, dbRole);

          if (
            data.active === false ||
            data.disabled === true ||
            data.deleted === true
          ) {
            roleCache = null;
            await signOut(auth);

            if (!cancelled) {
              setUser(null);
              setRole(null);
              setActive(false);
              setError("This account has been disabled.");
              setLoading(false);
            }

            return;
          }
        }

        setCachedRole(currentUser.uid, resolvedRole, resolvedActive);

        if (!cancelled) {
          setRole(resolvedRole);
          setActive(resolvedActive);
        }
      } catch (authRoleError) {
        console.error("AUTH ROLE ERROR:", authRoleError);

        roleCache = null;

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

  return useMemo(() => {
    const isTank = role === "tank";
    const isAdmin = role === "admin" || isTank;
    const isStaff = role === "staff";
    const isAdminOrStaff = isAdmin || isStaff || isTank;
    const isActiveUser = active !== false;
    const canAccessCommandCenter = Boolean(user && isActiveUser && isAdminOrStaff);

    return {
      user,
      role,
      loading,
      error,
      active,
      isAdmin,
      isStaff,
      isTank,
      isAdminOrStaff,
      canAccessCommandCenter,
      canUploadReports: canAccessCommandCenter,
      canRefreshImports: canAccessCommandCenter,
      canDeleteImports: canAccessCommandCenter && isAdmin,
      canReadAuditLogs: canAccessCommandCenter && isAdmin,
    };
  }, [user, role, loading, error, active]);
}
