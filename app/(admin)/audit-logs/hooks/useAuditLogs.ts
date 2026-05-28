"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
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
  refresh: () => void;
};

export function useAuditLogs({
  enabled,
}: UseAuditLogsParams): UseAuditLogsResult {
  const mountedRef = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const cleanupSubscription = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
  }, []);

  const subscribeToAuditLogs = useCallback(
    (options?: { silent?: boolean }) => {
      cleanupSubscription();

      if (!options?.silent) {
        setRefreshing(true);
      }

      const auditQuery = query(
        collection(db, "auditLogs"),
        orderBy("createdAt", "desc"),
        limit(AUDIT_PAGE_SIZE)
      );

      unsubscribeRef.current = onSnapshot(
        auditQuery,
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
    [cleanupSubscription]
  );

  useEffect(() => {
    mountedRef.current = true;

    queueMicrotask(() => {
      if (!mountedRef.current) return;

      if (!enabled) {
        cleanupSubscription();
        setLogs([]);
        setHasLoadedOnce(false);
        setRefreshing(false);
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
    refresh,
  };
}
