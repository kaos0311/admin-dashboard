"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  type UploadTask,
  type UploadTaskSnapshot,
} from "firebase/storage";

import { db, storage } from "@/lib/firebase";
import type {
  AuthRoleState,
  ImportMode,
  ReportType,
  UploadQueueItem,
} from "../upload-types";
import {
  getFileExtension,
  isActiveUpload,
  sanitizeFileName,
  validateUploadFile,
} from "../upload-utils";

type AuditSeverity = "info" | "warning" | "error";

type UseUploadQueueParams = {
  canManageUploads: boolean;
  user: AuthRoleState["user"];
  reportType: ReportType;
  importMode: ImportMode;
  writeAuditLog: (
    action: string,
    payload?: Record<string, unknown>,
    severity?: AuditSeverity,
  ) => Promise<void>;
};

const MAX_CONCURRENT_UPLOADS = 3;

function getContentType(file: File, extension: string): string {
  if (file.type) return file.type;

  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "csv":
      return "text/csv";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xls":
      return "application/vnd.ms-excel";
    default:
      return "application/octet-stream";
  }
}

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export function useUploadQueue({
  canManageUploads,
  user,
  reportType,
  importMode,
  writeAuditLog,
}: UseUploadQueueParams) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTasksRef = useRef<Record<string, UploadTask>>({});

  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

  const hasActiveUploads = useMemo(
    () => uploadQueue.some((item) => isActiveUpload(item.status)),
    [uploadQueue],
  );

  const uploadSummary = useMemo(() => {
    return uploadQueue.reduce(
      (acc, item) => {
        acc.total += 1;

        if (item.status === "complete") acc.complete += 1;
        if (item.status === "failed") acc.failed += 1;
        if (isActiveUpload(item.status)) acc.active += 1;

        return acc;
      },
      { total: 0, active: 0, complete: 0, failed: 0 },
    );
  }, [uploadQueue]);

  const updateUploadQueueItem = useCallback(
    (id: string, patch: Partial<UploadQueueItem>) => {
      setUploadQueue((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const cleanupUploadTask = useCallback((id: string) => {
    delete uploadTasksRef.current[id];
  }, []);

  const handleFilesSelected = useCallback((files: FileList | File[]) => {
    const selectedFiles = Array.from(files);

    if (!selectedFiles.length) return;

    const nextItems: UploadQueueItem[] = selectedFiles.map((file) => {
      const validation = validateUploadFile(file);

      return {
        id: crypto.randomUUID(),
        file,
        status: validation.valid ? "idle" : "failed",
        progress: 0,
        error: validation.error,
      };
    });

    setUploadQueue((current) => [...nextItems, ...current]);
  }, []);

  const uploadSingleFile = useCallback(
    async (item: UploadQueueItem) => {
      if (!canManageUploads || !user?.uid) {
        updateUploadQueueItem(item.id, {
          status: "failed",
          error: "You do not have permission to upload reports.",
        });
        return;
      }

      const validation = validateUploadFile(item.file);

      if (!validation.valid) {
        updateUploadQueueItem(item.id, {
          status: "failed",
          error: validation.error ?? "Invalid upload file.",
          progress: 0,
        });
        return;
      }

      const safeFileName = sanitizeFileName(item.file.name);
      const extension = getFileExtension(safeFileName);
      const contentType = getContentType(item.file, extension);

      let jobId: string | undefined;

      try {
        updateUploadQueueItem(item.id, {
          status: "creating_job",
          progress: 0,
          error: undefined,
        });

        const jobRef = await addDoc(collection(db, "importJobs"), {
          fileName: safeFileName,
          originalName: item.file.name,
          originalFileName: item.file.name,
          reportType,
          importMode,
          status: "queued",
          progress: 0,
          sizeBytes: item.file.size,
          contentType,
          extension,
          createdByUid: user.uid,
          createdByEmail: user.email ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          source: "reports_upload_page",
        });

        jobId = jobRef.id;

        updateUploadQueueItem(item.id, {
          status: "uploading",
          jobId,
          progress: 0,
        });

        const storagePath = `reports/uploads/${jobId}/${safeFileName}`;
        const storageRef = ref(storage, storagePath);

        await new Promise<void>((resolve, reject) => {
          const uploadTask = uploadBytesResumable(storageRef, item.file, {
            contentType,
            customMetadata: {
              jobId: jobId ?? "",
              reportType,
              importMode,
              originalName: item.file.name,
              uploadedByUid: user.uid ?? "",
              createdByEmail: user.email ?? "",
            },
          });

          uploadTasksRef.current[item.id] = uploadTask;

          uploadTask.on(
            "state_changed",
            (snapshot: UploadTaskSnapshot) => {
              const progress =
                snapshot.totalBytes > 0
                  ? Math.round(
                      (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
                    )
                  : 0;

              updateUploadQueueItem(item.id, {
                status: "uploading",
                progress,
              });

              void setDoc(
                jobRef,
                {
                  progress,
                  uploadBytesTransferred: snapshot.bytesTransferred,
                  uploadTotalBytes: snapshot.totalBytes,
                  updatedAt: serverTimestamp(),
                },
                { merge: true },
              );
            },
            reject,
            () => resolve(),
          );
        });

        cleanupUploadTask(item.id);

        updateUploadQueueItem(item.id, {
          status: "finalizing",
          progress: 100,
        });

        await updateDoc(jobRef, {
          status: "uploaded",
          progress: 100,
          storagePath,
          uploadedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await writeAuditLog("report_upload_completed", {
          jobId,
          fileName: safeFileName,
          originalName: item.file.name,
          reportType,
          importMode,
          sizeBytes: item.file.size,
          storagePath,
        });

        updateUploadQueueItem(item.id, {
          status: "complete",
          progress: 100,
          jobId,
          error: undefined,
        });
      } catch (error) {
        cleanupUploadTask(item.id);

        const message =
          error instanceof Error ? error.message : "Upload failed unexpectedly.";

        console.error("[reports/upload] upload failed:", error);

        updateUploadQueueItem(item.id, {
          status: "failed",
          progress: 0,
          jobId,
          error: message,
        });

        if (jobId) {
          try {
            await updateDoc(doc(db, "importJobs", jobId), {
              status: "failed",
              errorMessage: message,
              failedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (updateError) {
            console.error(
              "[reports/upload] failed to mark job failed:",
              updateError,
            );
          }
        }

        await writeAuditLog(
          "report_upload_failed",
          {
            jobId: jobId ?? null,
            fileName: safeFileName,
            originalName: item.file.name,
            reportType,
            importMode,
            sizeBytes: item.file.size,
            error: message,
          },
          "error",
        );
      }
    },
    [
      canManageUploads,
      cleanupUploadTask,
      importMode,
      reportType,
      updateUploadQueueItem,
      user?.email,
      user?.uid,
      writeAuditLog,
    ],
  );

  const handleStartUploads = useCallback(async () => {
    const pendingItems = uploadQueue.filter((item) => item.status === "idle");

    const batches = chunkItems(pendingItems, MAX_CONCURRENT_UPLOADS);

    for (const batch of batches) {
      await Promise.all(batch.map((item) => uploadSingleFile(item)));
    }
  }, [uploadQueue, uploadSingleFile]);

  const retryUpload = useCallback(
    async (id: string) => {
      const item = uploadQueue.find((queueItem) => queueItem.id === id);

      if (!item || isActiveUpload(item.status)) return;

      updateUploadQueueItem(id, {
        status: "idle",
        progress: 0,
        error: undefined,
      });

      await uploadSingleFile({
        ...item,
        status: "idle",
        progress: 0,
        error: undefined,
      });
    },
    [uploadQueue, updateUploadQueueItem, uploadSingleFile],
  );

  const pauseUpload = useCallback(
    (id: string) => {
      const task = uploadTasksRef.current[id];

      if (!task) return;

      task.pause();

      updateUploadQueueItem(id, {
        error: "Upload paused.",
      });
    },
    [updateUploadQueueItem],
  );

  const resumeUpload = useCallback(
    (id: string) => {
      const task = uploadTasksRef.current[id];

      if (!task) return;

      task.resume();

      updateUploadQueueItem(id, {
        error: undefined,
      });
    },
    [updateUploadQueueItem],
  );

  const cancelUpload = useCallback(
    (id: string) => {
      const task = uploadTasksRef.current[id];

      if (!task) return;

      task.cancel();
      cleanupUploadTask(id);

      updateUploadQueueItem(id, {
        status: "failed",
        progress: 0,
        error: "Upload canceled.",
      });
    },
    [cleanupUploadTask, updateUploadQueueItem],
  );

  const handleClearCompletedUploads = useCallback(() => {
    setUploadQueue((current) =>
      current.filter(
        (item) => item.status !== "complete" && item.status !== "failed",
      ),
    );
  }, []);

  const handleRemoveQueuedUpload = useCallback(
    (id: string) => {
      setUploadQueue((current) =>
        current.filter((item) => {
          if (item.id !== id) return true;
          return isActiveUpload(item.status);
        }),
      );
    },
    [],
  );

  return {
    fileInputRef,

    uploadQueue,
    uploadSummary,
    hasActiveUploads,

    handleFilesSelected,
    handleStartUploads,
    handleClearCompletedUploads,
    handleRemoveQueuedUpload,

    cancelUpload,
    pauseUpload,
    resumeUpload,
    retryUpload,
  };
}






