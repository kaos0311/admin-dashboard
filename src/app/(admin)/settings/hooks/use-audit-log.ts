"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  Timestamp,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AdminAuditEntry } from "../components/audit/types";

// Re-export for convenience
export type { AdminAuditEntry };

export interface UseAuditLogOptions {
  pageSize?: number;
}

export interface UseAuditLogReturn {
  entries: AdminAuditEntry[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export function useAuditLog(options: UseAuditLogOptions = {}): UseAuditLogReturn {
  const pageSize = options.pageSize ?? 25;

  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const lastVisibleRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const loadingRef = useRef<boolean>(false);

  const buildQuery = useCallback(
    (cursorDoc: QueryDocumentSnapshot<DocumentData> | null) => {
      return query(
        collection(db, "auditLogs"),
        orderBy("timestamp", "desc"),
        limit(pageSize + 1),
        ...(cursorDoc ? [startAfter(cursorDoc)] : []),
      );
    },
    [pageSize],
  );

  const subscribeToPage = useCallback(
    (cursorDoc: QueryDocumentSnapshot<DocumentData> | null, append: boolean) => {
      // Clean up any previous listener
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      const q = buildQuery(cursorDoc);
      loadingRef.current = true;
      setLoading(true);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs = snapshot.docs;
          const hasMoreDocs = docs.length > pageSize;
          const visibleDocs = hasMoreDocs ? docs.slice(0, pageSize) : docs;

          const newEntries: AdminAuditEntry[] = visibleDocs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              action: data.action ?? '',
              performedByUid: data.performedByUid ?? '',
              performedByEmail: data.performedByEmail ?? '',
              targetUid: data.targetUid ?? null,
              targetEmail: data.targetEmail ?? null,
              details: data.details ?? null,
              timestamp:
                data.timestamp instanceof Timestamp
                  ? data.timestamp.toDate()
                  : null,
              ipAddress: data.ipAddress ?? null,
              userAgent: data.userAgent ?? null,
              success: data.success ?? false,
              failureReason: data.failureReason ?? null,
            };
          });

          // Store the last visible document for pagination
          if (visibleDocs.length > 0) {
            lastVisibleRef.current = docs[visibleDocs.length - 1];
          } else {
            lastVisibleRef.current = null;
          }

          setHasMore(hasMoreDocs);
          setError(null);

          if (append) {
            setEntries((prev) => [...prev, ...newEntries]);
          } else {
            setEntries(newEntries);
          }

          loadingRef.current = false;
          setLoading(false);
        },
        (err) => {
          setError(err.message);
          loadingRef.current = false;
          setLoading(false);
        },
      );

      unsubscribeRef.current = unsubscribe;
    },
    [buildQuery, pageSize],
  );

  // Initial load
  useEffect(() => {
    subscribeToPage(null, false);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [subscribeToPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingRef.current) return;
    if (!lastVisibleRef.current) return;

    subscribeToPage(lastVisibleRef.current, true);
  }, [hasMore, subscribeToPage]);

  const refresh = useCallback(() => {
    subscribeToPage(null, false);
  }, [subscribeToPage]);

  return {
    entries,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
