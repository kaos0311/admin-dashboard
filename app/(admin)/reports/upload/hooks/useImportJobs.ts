"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteField,
  doc,
  type FirestoreError,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { httpsCallable } from "firebase/functions";

import { db, functions, storage } from "@/lib/firebase";
import { getImportRetentionCutoff } from "@/lib/importRetention";
import type {
  AuthRoleState,
  QueueFilter,
  RecentImportJob,
} from "../upload-types";
import { readJob } from "../upload-utils";

type AuditSeverity = "info" | "warning" | "error";

type QueueCounts = Record<QueueFilter, number>;

type UseImportJobsParams = {
  canManageUploads: boolean;
  user: AuthRoleState["user"];
  role: string | null;
};

const RECENT_IMPORT_LIMIT = 80;
const BULK_CONCURRENCY_LIMIT = 5;

function isCompletedStatus(status: RecentImportJob["status"]): boolean {
  return status === "completed" || status === "completed_with_errors";
}

function isProcessingStatus(status: RecentImportJob["status"]): boolean {
  return status === "active" || status === "processing" || status === "uploaded";
}

function matchesQueueFilter(
  job: RecentImportJob,
  queueFilter: QueueFilter,
): boolean {
  if (queueFilter === "all") return true;
  if (queueFilter === "completed") return isCompletedStatus(job.status);
  if (queueFilter === "processing") return isProcessingStatus(job.status);
  if (queueFilter === "failed") return job.status === "failed";

  return job.status === queueFilter;
}

function buildJobSearchHaystack(job: RecentImportJob): string {
  return [
    job.id,
    job.fileName,
    job.originalName,
    job.originalFileName,
    job.reportType,
    job.importMode,
    job.status,
    job.createdByEmail,
    job.errorMessage,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

async function runWithConcurrency<T>(
  items: T[],
  limitSize: number,
  runner: (item: T) => Promise<void>,
): Promise<PromiseSettledResult<void>[]> {
  const results: PromiseSettledResult<void>[] = [];
  const executing = new Set<Promise<void>>();

  for (const item of items) {
    const promise = runner(item).finally(() => {
      executing.delete(promise);
    });

    executing.add(promise);

    promise
      .then(() => {
        results.push({ status: "fulfilled", value: undefined });
      })
      .catch((reason: unknown) => {
        results.push({ status: "rejected", reason });
      });

    if (executing.size >= limitSize) {
      await Promise.race(executing);
    }
  }

  await Promise.allSettled(executing);

  return results;
}

export function useImportJobs({
  canManageUploads,
  user,
  role,
}: UseImportJobsParams) {
  const [recentJobs, setRecentJobs] = useState<RecentImportJob[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  const [jobsLoading, setJobsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [busyJobIds, setBusyJobIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [queueSearch, setQueueSearch] = useState("");

  const selectedJobs = useMemo(
    () => recentJobs.filter((job) => selectedJobIds.has(job.id)),
    [recentJobs, selectedJobIds],
  );

  const filteredJobs = useMemo(() => {
    const search = queueSearch.trim().toLowerCase();

    return recentJobs.filter((job) => {
      if (!matchesQueueFilter(job, queueFilter)) return false;
      if (!search) return true;

      return buildJobSearchHaystack(job).includes(search);
    });
  }, [queueFilter, queueSearch, recentJobs]);

  const queueCounts = useMemo<QueueCounts>(() => {
    return recentJobs.reduce(
      (acc, job) => {
        acc.all += 1;

        if (job.status === "queued") acc.queued += 1;
        if (isProcessingStatus(job.status)) acc.processing += 1;
        if (isCompletedStatus(job.status)) acc.completed += 1;
        if (job.status === "failed") acc.failed += 1;
        if (job.status === "deleted") acc.deleted += 1;

        return acc;
      },
      {
        all: 0,
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        deleted: 0,
      },
    );
  }, [recentJobs]);

  const writeAuditLog = useCallback(
    async (
      action: string,
      payload: Record<string, unknown> = {},
      severity: AuditSeverity = "info",
    ) => {
      if (!user?.uid) return;

      try {
        await addDoc(collection(db, "auditLogs"), {
          action,
          area: "reports.upload",
          severity,
          actorUid: user.uid,
          actorEmail: user.email ?? null,
          actorRole: role ?? null,
          payload,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("[reports/upload] Failed to write audit log:", error);
      }
    },
    [role, user?.email, user?.uid],
  );

  const setJobBusy = useCallback((jobId: string, busy: boolean) => {
    setBusyJobIds((current) => {
      const next = new Set(current);

      if (busy) {
        next.add(jobId);
      } else {
        next.delete(jobId);
      }

      return next;
    });
  }, []);

  const isJobBusy = useCallback(
    (jobId: string) => busyJobIds.has(jobId),
    [busyJobIds],
  );

  const clearSelection = useCallback(() => {
    setSelectedJobIds(new Set());
  }, []);

  const selectFailedJobs = useCallback(() => {
    setSelectedJobIds(
      new Set(
        filteredJobs
          .filter((job) => job.status === "failed")
          .map((job) => job.id),
      ),
    );
  }, [filteredJobs]);

  const selectCompletedJobs = useCallback(() => {
    setSelectedJobIds(
      new Set(
        filteredJobs
          .filter((job) => isCompletedStatus(job.status))
          .map((job) => job.id),
      ),
    );
  }, [filteredJobs]);

  useEffect(() => {
    if (!canManageUploads) {
      setRecentJobs([]);
      setSelectedJobIds(new Set());
      setJobsLoading(false);
      return undefined;
    }

    setJobsLoading(true);

    const jobsQuery = query(
      collection(db, "importJobs"),
      where("createdAt", ">=", getImportRetentionCutoff()),
      orderBy("createdAt", "desc"),
      limit(RECENT_IMPORT_LIMIT),
    );

    const unsubscribe = onSnapshot(
      jobsQuery,
      (snapshot) => {
        const jobs = snapshot.docs.map((item) =>
          readJob(item.id, item.data()),
        );

        setRecentJobs(jobs);
        setJobsLoading(false);
        setPageError(null);
      },
      (error: FirestoreError) => {
        console.error("[reports/upload] importJobs listener failed:", error);

        setPageError(error.message || "Unable to load recent import jobs.");
        setJobsLoading(false);
      },
    );

    return unsubscribe;
  }, [canManageUploads]);

  useEffect(() => {
    setSelectedJobIds((current) => {
      if (!current.size) return current;

      const validIds = new Set(recentJobs.map((job) => job.id));
      const next = new Set([...current].filter((id) => validIds.has(id)));

      return next.size === current.size ? current : next;
    });
  }, [recentJobs]);

  const refreshJob = useCallback(
    async (job: RecentImportJob) => {
      if (!canManageUploads) return;

      setJobBusy(job.id, true);

      try {
        await updateDoc(doc(db, "importJobs", job.id), {
          status: "queued",
          processingStatus: "queued_for_reprocess",
          processingStage: "queued_for_reprocess",
          progress: 0,
          progressPercent: 0,
          processedRows: 0,
          writtenRows: 0,
          skippedRows: 0,
          issueCount: 0,
          failedQueueJobs: 0,
          deadLetteredQueueJobs: 0,
          destinationSummary: deleteField(),
          jarvisScreening: {
            status: "pending",
            message: "Jarvis is waiting for this report to finish reprocessing before screening it again.",
            findings: ["Report reprocess was requested and is waiting on the import pipeline."],
            resolvedFindings: job.jarvisScreening?.resolvedFindings ?? [],
            remainingFindingCount: 1,
            recommendations: [
              "Wait for the import job to finish, then click Run Check Again if Jarvis does not update automatically.",
            ],
            checkedAt: serverTimestamp(),
            checkedBy: "jarvis",
          },
          refreshRequestedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          errorMessage: null,
        });

        try {
          const reprocessImportJob = httpsCallable(
            functions,
            "reprocessImportJob",
          );

          await reprocessImportJob({ jobId: job.id });
        } catch (callableError) {
          console.warn(
            "[reports/upload] reprocessImportJob callable unavailable or failed:",
            callableError,
          );
        }

        await writeAuditLog("report_import_refresh_requested", {
          jobId: job.id,
          fileName: job.fileName,
          reportType: job.reportType,
          importMode: job.importMode,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to refresh import job.";

        console.error("[reports/upload] refresh failed:", error);
        setPageError(message);

        await writeAuditLog(
          "report_import_refresh_failed",
          {
            jobId: job.id,
            fileName: job.fileName,
            error: message,
          },
          "error",
        );

        throw error;
      } finally {
        setJobBusy(job.id, false);
      }
    },
    [canManageUploads, setJobBusy, writeAuditLog],
  );

  const deleteJob = useCallback(
    async (job: RecentImportJob) => {
      if (!canManageUploads) return;

      setJobBusy(job.id, true);

      try {
        if (job.storagePath) {
          try {
            await deleteObject(ref(storage, job.storagePath));
          } catch (storageError) {
            console.warn(
              "[reports/upload] storage object delete skipped/failed:",
              storageError,
            );
          }
        }

        await setDoc(
          doc(db, "importJobs", job.id),
          {
            status: "deleted",
            deletedAt: serverTimestamp(),
            deletedByUid: user?.uid ?? null,
            deletedByEmail: user?.email ?? null,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        setSelectedJobIds((current) => {
          const next = new Set(current);
          next.delete(job.id);
          return next;
        });

        await writeAuditLog("report_import_deleted", {
          jobId: job.id,
          fileName: job.fileName,
          storagePath: job.storagePath ?? null,
          reportType: job.reportType,
          importMode: job.importMode,
          softDeleted: true,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to delete import job.";

        console.error("[reports/upload] delete failed:", error);
        setPageError(message);

        await writeAuditLog(
          "report_import_delete_failed",
          {
            jobId: job.id,
            fileName: job.fileName,
            error: message,
          },
          "error",
        );

        throw error;
      } finally {
        setJobBusy(job.id, false);
      }
    },
    [
      canManageUploads,
      setJobBusy,
      user?.email,
      user?.uid,
      writeAuditLog,
    ],
  );

  const handleRefreshSelected = useCallback(async () => {
    if (!selectedJobs.length || bulkBusy) return;

    setBulkBusy(true);
    setPageError(null);

    try {
      const results = await runWithConcurrency(
        selectedJobs,
        BULK_CONCURRENCY_LIMIT,
        refreshJob,
      );

      const failures = results.filter(
        (result) => result.status === "rejected",
      ).length;

      if (failures > 0) {
        setPageError(
          `${failures} selected import job${
            failures === 1 ? "" : "s"
          } failed to refresh.`,
        );
      }
    } finally {
      setBulkBusy(false);
    }
  }, [bulkBusy, refreshJob, selectedJobs]);

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedJobs.length || bulkBusy) return;

    setBulkBusy(true);
    setPageError(null);

    try {
      const results = await runWithConcurrency(
        selectedJobs,
        BULK_CONCURRENCY_LIMIT,
        deleteJob,
      );

      const failures = results.filter(
        (result) => result.status === "rejected",
      ).length;

      if (failures > 0) {
        setPageError(
          `${failures} selected import job${
            failures === 1 ? "" : "s"
          } failed to delete.`,
        );
      }
    } finally {
      setBulkBusy(false);
    }
  }, [bulkBusy, deleteJob, selectedJobs]);

  const toggleSelectedJob = useCallback((jobId: string) => {
    setSelectedJobIds((current) => {
      const next = new Set(current);

      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }

      return next;
    });
  }, []);

  const toggleAllVisibleJobs = useCallback(() => {
    setSelectedJobIds((current) => {
      const next = new Set(current);

      const allVisibleSelected =
        filteredJobs.length > 0 &&
        filteredJobs.every((job) => next.has(job.id));

      if (allVisibleSelected) {
        filteredJobs.forEach((job) => next.delete(job.id));
      } else {
        filteredJobs.forEach((job) => next.add(job.id));
      }

      return next;
    });
  }, [filteredJobs]);

  return {
    recentJobs,
    filteredJobs,

    selectedJobIds,
    selectedJobs,

    jobsLoading,
    pageError,
    setPageError,

    busyJobIds,
    bulkBusy,

    queueFilter,
    setQueueFilter,

    queueSearch,
    setQueueSearch,

    queueCounts,

    refreshJob,
    deleteJob,

    handleRefreshSelected,
    handleDeleteSelected,

    toggleSelectedJob,
    toggleAllVisibleJobs,

    clearSelection,
    selectFailedJobs,
    selectCompletedJobs,
    isJobBusy,

    writeAuditLog,
  };
}



