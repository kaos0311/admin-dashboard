"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { unstable_batchedUpdates } from "react-dom";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import type { UserRole } from "@/lib/adminUsers";
import { PAGE_SIZE, type UserRow, type UserStats } from "./users-types";
import {
  areUsersEqual,
  getErrorMessage,
  mergeUsers,
  normalizeUserRow,
} from "./users-utils";

export function useUsersData({
  authLoading,
  isAdmin,
}: {
  authLoading: boolean;
  isAdmin: boolean;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "disabled"
  >("all");

  const baseUsersQuery = useMemo(() => {
    return query(
      collection(db, "users"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAdmin) {
      unstable_batchedUpdates(() => {
        setUsers([]);
        setLoadingUsers(false);
        setLastDoc(null);
        setHasMore(false);
      });
      return;
    }

    setLoadingUsers(true);

    const unsubscribe = onSnapshot(
      baseUsersQuery,
      (snapshot) => {
        const nextRows = snapshot.docs.map((docSnap) =>
          normalizeUserRow(docSnap.id, docSnap.data() as Partial<UserRow>)
        );

        unstable_batchedUpdates(() => {
          setUsers((previous) =>
            areUsersEqual(previous.slice(0, PAGE_SIZE), nextRows)
              ? previous
              : mergeUsers(previous.length > PAGE_SIZE ? previous : [], nextRows)
          );

          setLastDoc(snapshot.docs.at(-1) ?? null);
          setHasMore(snapshot.docs.length === PAGE_SIZE);
          setLoadingUsers(false);
        });
      },
      (error: unknown) => {
        console.error("USERS SNAPSHOT ERROR:", error);
        toast.error(getErrorMessage(error, "Failed to sync users."));

        unstable_batchedUpdates(() => {
          setLoadingUsers(false);
          setHasMore(false);
        });
      }
    );

    return () => unsubscribe();
  }, [authLoading, isAdmin, baseUsersQuery]);

  async function loadMoreUsers() {
    if (!isAdmin || !lastDoc || loadingMore) return;

    try {
      setLoadingMore(true);

      const nextQuery = query(
        collection(db, "users"),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(nextQuery);

      const nextRows = snapshot.docs.map((docSnap) =>
        normalizeUserRow(docSnap.id, docSnap.data() as Partial<UserRow>)
      );

      unstable_batchedUpdates(() => {
        setUsers((previous) => mergeUsers(previous, nextRows));
        setLastDoc(snapshot.docs.at(-1) ?? lastDoc);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      });
    } catch (error: unknown) {
      console.error("LOAD MORE USERS ERROR:", error);
      toast.error(getErrorMessage(error, "Failed to load more users."));
    } finally {
      setLoadingMore(false);
    }
  }

  const filteredUsers = useMemo<UserRow[]>(() => {
    const needle = search.toLowerCase();

    return users.filter((user) => {
      if (needle) {
        const matchesSearch =
          user.email.toLowerCase().includes(needle) ||
          user.displayName.toLowerCase().includes(needle) ||
          user.uid.toLowerCase().includes(needle) ||
          user.phone.toLowerCase().includes(needle);

        if (!matchesSearch) return false;
      }

      if (roleFilter !== "all" && user.role !== roleFilter) return false;

      if (
        statusFilter !== "all" &&
        (statusFilter === "active" ? !user.active : user.active)
      ) {
        return false;
      }

      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const stats = useMemo<UserStats>(() => {
    let admins = 0;
    let staff = 0;
    let active = 0;
    let disabled = 0;

    for (const user of users) {
      if (user.role === "admin") admins += 1;
      if (user.role === "staff") staff += 1;
      if (user.active) active += 1;
      else disabled += 1;
    }

    return {
      total: users.length,
      admins,
      staff,
      active,
      disabled,
    };
  }, [users]);

  return {
    users,
    setUsers,
    filteredUsers,
    stats,
    loadingUsers,
    loadingMore,
    hasMore,
    loadMoreUsers,
    searchInput,
    setSearchInput,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
  };
}