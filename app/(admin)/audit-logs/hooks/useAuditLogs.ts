"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";

import toast from "react-hot-toast";

import { db } from "@/lib/firebase";

import { mapAuditDoc } from "../utils/auditNormalize";
import type { AuditLogRow } from "../utils/auditTypes";

const AUDIT_PAGE_SIZE = 250;

type UseAuditLogsParams = {
  enabled: boolean;
};

type UseAuditLogsResult = {
  logs: AuditLogRow[];
  loading: boolean;
  refreshing: boolean;
  purging: boolean;
  refresh: () => void;
  purgeCurrentAuditLogs: () => Promise<void>;
};

export function useAuditLogs({
  enabled,
}: UseAuditLogsParams): UseAuditLogsResult {
  const mountedRef = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [purging, setPurging] = useState(false);

  const cleanupSubscription = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
  }, []);

  const auditQuery = useCallback(
    () =>
      query(
        collection(db, "auditLogs"),
        orderBy("createdAt", "desc"),
        limit(AUDIT_PAGE_SIZE)
      ),
    []
  );

  const subscribeToAuditLogs = useCallback(
    (options?: { silent?: boolean }) => {
      cleanupSubscription();

      if (!options?.silent) {
        setRefreshing(true);
      }

      unsubscribeRef.current = onSnapshot(
        auditQuery(),
        (snapshot) => {
          if (!mountedRef.current) return;

          setLogs(snapshot.docs.map(mapAuditDoc));
          setHasLoadedOnce(true);
          setRefreshing(false);
        },
        (error) => {
          console.error("AUDIT LOGS SNAPSHOT ERROR:", error);

          if (!mountedRef.current) return;

          toast.error("Audit feed could not be loaded.");
          setHasLoadedOnce(true);
          setRefreshing(false);
        }
      );
    },
    [auditQuery, cleanupSubscription]
  );

  const purgeCurrentAuditLogs = useCallback(async () => {
    if (!enabled || purging) return;

    const confirmed = window.confirm(
      "Delete the currently loaded audit logs? This cannot be undone."
    );

    if (!confirmed) return;

    setPurging(true);

    try {
      const snapshot = await getDocs(auditQuery());

      if (snapshot.empty) {
        toast("No audit logs to delete.");
        return;
      }

      const batch = writeBatch(db);

      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();

      setLogs([]);
      toast.success(`${snapshot.size} audit log(s) deleted.`);
    } catch (error) {
      console.error("AUDIT LOG PURGE ERROR:", error);
      toast.error("Audit logs could not be deleted.");
    } finally {
      if (mountedRef.current) {
        setPurging(false);
      }
    }
  }, [auditQuery, enabled, purging]);

  useEffect(() => {
    mountedRef.current = true;

    queueMicrotask(() => {
      if (!mountedRef.current) return;

      if (!enabled) {
        cleanupSubscription();
        setLogs([]);
        setHasLoadedOnce(false);
        setRefreshing(false);
        setPurging(false);
        return;
      }

      subscribeToAuditLogs({ silent: true });
    });

    return () => {
      mountedRef.current = false;
      cleanupSubscription();
    };
  }, [cleanupSubscription, enabled, subscribeToAuditLogs]);

  const refresh = useCallback(() => {
    if (!enabled || refreshing) return;

    subscribeToAuditLogs();
    toast.success("Audit feed refreshed.");
  }, [enabled, refreshing, subscribeToAuditLogs]);

  return {
    logs,
    loading: enabled && !hasLoadedOnce,
    refreshing,
    purging,
    refresh,
    purgeCurrentAuditLogs,
  };
}