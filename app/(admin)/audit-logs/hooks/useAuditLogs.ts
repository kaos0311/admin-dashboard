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

export function useAuditLogs({ enabled }: { enabled: boolean }) {
  const mountedRef = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);

  const loadRealtimeLogs = useCallback(() => {
    unsubscribeRef.current?.();
    setRefreshing(true);

    const auditQuery = query(
      collection(db, "auditLogs"),
      orderBy("createdAt", "desc"),
      limit(AUDIT_PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      auditQuery,
      (snapshot) => {
        if (!mountedRef.current) return;

        const nextLogs = snapshot.docs.map(mapAuditDoc);

        setLogs(nextLogs);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("AUDIT LOGS SNAPSHOT ERROR:", error);

        if (!mountedRef.current) return;

        toast.error("Audit feed could not be loaded.");
        setLoading(false);
        setRefreshing(false);
      }
    );

    unsubscribeRef.current = unsubscribe;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      setLoading(true);
      loadRealtimeLogs();
    } else {
      setLoading(false);
      setLogs([]);
    }

    return () => {
      mountedRef.current = false;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [enabled, loadRealtimeLogs]);

  const refresh = useCallback(() => {
    if (refreshing) return;

    loadRealtimeLogs();
    toast.success("Audit feed refreshed.");
  }, [loadRealtimeLogs, refreshing]);

  return {
    logs,
    loading,
    refreshing,
    refresh,
  };
}