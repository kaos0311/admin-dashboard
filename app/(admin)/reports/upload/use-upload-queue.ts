"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTask,
} from "firebase/storage";

import { storage } from "@/lib/firebase/client";

export type UploadQueueStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "completed"
  | "error"
  | "cancelled";

export type UploadQueueItem = {
  id: string;
  file: File;

  fileName: string;
  contentType: string;
  size: number;

  progress: number;
  transferredBytes: number;

  status: UploadQueueStatus;

  storagePath?: string;
  downloadUrl?: string;

  error?: string;

  startedAt?: number;
  completedAt?: number;

  uploadTask?: UploadTask;
};

type UseUploadQueueOptions = {
  storageFolder?: string;

  concurrentUploads?: number;

  onUploadComplete?: (item: UploadQueueItem) => Promise<void> | void;

  onUploadError?: (
    item: UploadQueueItem,
    error: Error,
  ) => Promise<void> | void;
};

type AddFilesOptions = {
  autoStart?: boolean;
};

const DEFAULT_STORAGE_FOLDER = "reports/uploads";
const DEFAULT_CONCURRENT_UPLOADS = 3;

function createUploadId(): string {
  return crypto.randomUUID();
}

function createStorageFileName(file: File): string {
  const timestamp = Date.now();
  const safeName = file.name.replace(/\s+/g, "-");

  return `${timestamp}-${safeName}`;
}

export function useUploadQueue(options?: UseUploadQueueOptions) {
  const {
    storageFolder = DEFAULT_STORAGE_FOLDER,
    concurrentUploads = DEFAULT_CONCURRENT_UPLOADS,
    onUploadComplete,
    onUploadError,
  } = options ?? {};

  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const activeUploadsRef = useRef<Set<string>>(new Set());

  const updateItem = useCallback(
    (
      id: string,
      updater: (
        item: UploadQueueItem,
      ) => UploadQueueItem,
    ) => {
      setQueue((current) =>
        current.map((item) =>
          item.id === id ? updater(item) : item,
        ),
      );
    },
    [],
  );

  const removeItem = useCallback(
    async (id: string) => {
      const item = queue.find((entry) => entry.id === id);

      if (!item) return;

      try {
        item.uploadTask?.cancel();

        if (item.storagePath) {
          await deleteObject(
            ref(storage, item.storagePath),
          );
        }
      } catch (error) {
        console.error(
          "Failed to remove upload item:",
          error,
        );
      }

      setQueue((current) =>
        current.filter((entry) => entry.id !== id),
      );
    },
    [queue],
  );

  const clearCompleted = useCallback(() => {
    setQueue((current) =>
      current.filter(
        (item) =>
          item.status !== "completed" &&
          item.status !== "cancelled",
      ),
    );
  }, []);

  const resetQueue = useCallback(() => {
    queue.forEach((item) => {
      item.uploadTask?.cancel();
    });

    setQueue([]);
    activeUploadsRef.current.clear();
    setIsUploading(false);
  }, [queue]);

  const uploadItem = useCallback(
    async (item: UploadQueueItem) => {
      if (
        activeUploadsRef.current.has(item.id)
      ) {
        return;
      }

      activeUploadsRef.current.add(item.id);

      try {
        updateItem(item.id, (current) => ({
          ...current,
          status: "uploading",
          startedAt: Date.now(),
        }));

        const storagePath = `${storageFolder}/${createStorageFileName(
          item.file,
        )}`;

        const storageRef = ref(
          storage,
          storagePath,
        );

        const uploadTask =
          uploadBytesResumable(
            storageRef,
            item.file,
            {
              contentType:
                item.contentType,
            },
          );

        updateItem(item.id, (current) => ({
          ...current,
          uploadTask,
          storagePath,
        }));

        await new Promise<void>(
          (resolve, reject) => {
            uploadTask.on(
              "state_changed",
              (snapshot) => {
                const progress =
                  snapshot.totalBytes === 0
                    ? 0
                    : Math.round(
                        (snapshot.bytesTransferred /
                          snapshot.totalBytes) *
                          100,
                      );

                updateItem(
                  item.id,
                  (current) => ({
                    ...current,
                    progress,
                    transferredBytes:
                      snapshot.bytesTransferred,
                    status:
                      progress >= 100
                        ? "processing"
                        : "uploading",
                  }),
                );
              },
              (error) => {
                reject(error);
              },
              async () => {
                resolve();
              },
            );
          },
        );

        const downloadUrl =
          await getDownloadURL(storageRef);

        const completedItem: UploadQueueItem =
          {
            ...item,
            storagePath,
            downloadUrl,
            progress: 100,
            transferredBytes:
              item.size,
            status: "completed",
            completedAt: Date.now(),
          };

        updateItem(item.id, () => completedItem);

        await onUploadComplete?.(
          completedItem,
        );
      } catch (error) {
        const uploadError =
          error instanceof Error
            ? error
            : new Error(
                "Upload failed.",
              );

        updateItem(item.id, (current) => ({
          ...current,
          status:
            uploadError.message.includes(
              "canceled",
            )
              ? "cancelled"
              : "error",
          error: uploadError.message,
        }));

        await onUploadError?.(
          item,
          uploadError,
        );

        console.error(
          "Upload queue error:",
          uploadError,
        );
      } finally {
        activeUploadsRef.current.delete(
          item.id,
        );
      }
    },
    [
      onUploadComplete,
      onUploadError,
      storageFolder,
      updateItem,
    ],
  );

  const processQueue = useCallback(async () => {
    if (isUploading) return;

    setIsUploading(true);

    try {
      while (true) {
        const queuedItems = queue.filter(
          (item) =>
            item.status === "queued",
        );

        if (queuedItems.length === 0) {
          break;
        }

        const availableSlots =
          concurrentUploads -
          activeUploadsRef.current.size;

        if (availableSlots <= 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, 200),
          );

          continue;
        }

        const nextBatch =
          queuedItems.slice(
            0,
            availableSlots,
          );

        await Promise.allSettled(
          nextBatch.map((item) =>
            uploadItem(item),
          ),
        );
      }
    } finally {
      setIsUploading(false);
    }
  }, [
    concurrentUploads,
    isUploading,
    queue,
    uploadItem,
  ]);

  const startQueue = useCallback(() => {
    void processQueue();
  }, [processQueue]);

  const pauseUpload = useCallback(
    (id: string) => {
      const item = queue.find(
        (entry) => entry.id === id,
      );

      item?.uploadTask?.pause();
    },
    [queue],
  );

  const resumeUpload = useCallback(
    (id: string) => {
      const item = queue.find(
        (entry) => entry.id === id,
      );

      item?.uploadTask?.resume();
    },
    [queue],
  );

  const cancelUpload = useCallback(
    (id: string) => {
      const item = queue.find(
        (entry) => entry.id === id,
      );

      item?.uploadTask?.cancel();

      updateItem(id, (current) => ({
        ...current,
        status: "cancelled",
      }));
    },
    [queue, updateItem],
  );

  const retryUpload = useCallback(
    (id: string) => {
      updateItem(id, (current) => ({
        ...current,
        progress: 0,
        transferredBytes: 0,
        status: "queued",
        error: undefined,
      }));

      void processQueue();
    },
    [processQueue, updateItem],
  );

  const addFiles = useCallback(
    (
      files:
        | File[]
        | FileList,
      addOptions?: AddFilesOptions,
    ) => {
      const normalizedFiles =
        Array.from(files);

      const newItems: UploadQueueItem[] =
        normalizedFiles.map((file) => ({
          id: createUploadId(),

          file,

          fileName: file.name,
          contentType:
            file.type ||
            "application/octet-stream",

          size: file.size,

          progress: 0,
          transferredBytes: 0,

          status: "queued",
        }));

      setQueue((current) => [
        ...current,
        ...newItems,
      ]);

      const shouldAutoStart =
        addOptions?.autoStart ??
        true;

      if (shouldAutoStart) {
        setTimeout(() => {
          void processQueue();
        }, 0);
      }

      return newItems;
    },
    [processQueue],
  );

  useEffect(() => {
    if (!isUploading) {
      const hasQueuedUploads =
        queue.some(
          (item) =>
            item.status === "queued",
        );

      if (hasQueuedUploads) {
        void processQueue();
      }
    }
  }, [
    isUploading,
    processQueue,
    queue,
  ]);

  const analytics = useMemo(() => {
    const totalFiles = queue.length;

    const completedFiles =
      queue.filter(
        (item) =>
          item.status === "completed",
      ).length;

    const failedFiles = queue.filter(
      (item) =>
        item.status === "error",
    ).length;

    const activeFiles = queue.filter(
      (item) =>
        item.status === "uploading" ||
        item.status === "processing",
    ).length;

    const overallProgress =
      totalFiles === 0
        ? 0
        : Math.round(
            queue.reduce(
              (sum, item) =>
                sum + item.progress,
              0,
            ) / totalFiles,
          );

    const totalBytes = queue.reduce(
      (sum, item) =>
        sum + item.size,
      0,
    );

    const transferredBytes =
      queue.reduce(
        (sum, item) =>
          sum +
          item.transferredBytes,
        0,
      );

    return {
      totalFiles,
      completedFiles,
      failedFiles,
      activeFiles,
      overallProgress,
      totalBytes,
      transferredBytes,
    };
  }, [queue]);

  return {
    queue,
    analytics,

    isUploading,

    addFiles,

    startQueue,

    retryUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,

    removeItem,
    clearCompleted,
    resetQueue,
  };
}
