import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentReference,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const db = getFirestore();
const storage = getStorage();

const CONFIRM_TEXT = "STERILIZE";
const DELETE_BATCH_SIZE = 300;
const STORAGE_DELETE_CHUNK_SIZE = 100;

const DEFAULT_COLLECTIONS_TO_DELETE = [
  "importJobs",
  "importedReports",
  "patients_index",
  "patients",
  "hospicePatients",
  "insurancePatients",
  "analytics",
  "auditLogs",
];

const OPTIONAL_BUSINESS_COLLECTIONS = ["products", "orders", "rentals"];

const STORAGE_PREFIXES_TO_DELETE = [
  "imports/",
  "reports/uploads/",
  "reports/imports/",
];

type CleanDatabasePayload = {
  confirmText?: string;
  includeBusinessData?: boolean;
  deleteUploadedFiles?: boolean;
  dryRun?: boolean;
};

type DeleteCollectionResult = {
  collectionPath: string;
  deletedCount: number;
};

type DeleteStorageResult = {
  prefix: string;
  deletedCount: number;
};

type CallableRequestLike = {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
};

function requireAdmin(request: CallableRequestLike): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  if (request.auth.token.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can clean the database."
    );
  }
}

function getPayload(data: unknown): CleanDatabasePayload {
  if (!data || typeof data !== "object") return {};
  return data as CleanDatabasePayload;
}

function getAuthEmail(request: CallableRequestLike): string {
  const email = request.auth?.token.email;
  return typeof email === "string" ? email : "";
}

async function countCollection(collectionPath: string): Promise<number> {
  const snap = await db.collection(collectionPath).count().get();
  return snap.data().count;
}

async function deleteDocumentWithSubcollections(
  docRef: DocumentReference,
  dryRun: boolean
): Promise<number> {
  let deletedCount = 0;

  const subcollections = await docRef.listCollections();

  for (const subcollection of subcollections) {
    deletedCount += await deleteCollectionRecursive(
      subcollection.path,
      DELETE_BATCH_SIZE,
      dryRun
    );
  }

  if (!dryRun) {
    await docRef.delete();
  }

  return deletedCount + 1;
}

async function deleteCollectionRecursive(
  collectionPath: string,
  batchSize = DELETE_BATCH_SIZE,
  dryRun = false
): Promise<number> {
  let deletedCount = 0;

  while (true) {
    const snap = await db.collection(collectionPath).limit(batchSize).get();

    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      deletedCount += await deleteDocumentWithSubcollections(
        docSnap.ref,
        dryRun
      );
    }

    if (dryRun) break;
  }

  return deletedCount;
}

async function deleteStoragePrefix(
  prefix: string,
  dryRun: boolean
): Promise<DeleteStorageResult> {
  const bucket = storage.bucket();

  const [files] = await bucket.getFiles({
    prefix,
    autoPaginate: true,
  });

  if (!dryRun && files.length > 0) {
    for (let i = 0; i < files.length; i += STORAGE_DELETE_CHUNK_SIZE) {
      const chunk = files.slice(i, i + STORAGE_DELETE_CHUNK_SIZE);

      await Promise.all(
        chunk.map(async (file) => {
          try {
            await file.delete({ ignoreNotFound: true });
          } catch (error) {
            logger.warn("Failed to delete storage file", {
              name: file.name,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })
      );
    }
  }

  return {
    prefix,
    deletedCount: files.length,
  };
}

export const cleanDatabase = onCall(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async (request) => {
    requireAdmin(request);

    const payload = getPayload(request.data);

    const confirmText = String(payload.confirmText || "");
    const includeBusinessData = payload.includeBusinessData === true;
    const deleteUploadedFiles = payload.deleteUploadedFiles === true;
    const dryRun = payload.dryRun === true;

    if (confirmText !== CONFIRM_TEXT) {
      throw new HttpsError(
        "failed-precondition",
        `Confirmation text must be ${CONFIRM_TEXT}.`
      );
    }

    const uid = request.auth!.uid;
    const email = getAuthEmail(request);

    const collectionsToDelete = includeBusinessData
      ? [...DEFAULT_COLLECTIONS_TO_DELETE, ...OPTIONAL_BUSINESS_COLLECTIONS]
      : DEFAULT_COLLECTIONS_TO_DELETE;

    const startedAt = Timestamp.now();

    const cleanJobRef = await db.collection("systemJobs").add({
      type: "cleanDatabase",
      status: dryRun ? "dry_run_processing" : "processing",
      requestedBy: uid,
      requestedByEmail: email,
      includeBusinessData,
      deleteUploadedFiles,
      dryRun,
      collectionsToDelete,
      storagePrefixesToDelete: deleteUploadedFiles
        ? STORAGE_PREFIXES_TO_DELETE
        : [],
      startedAt,
      updatedAt: startedAt,
    });

    try {
      const deletedCollections: Record<string, number> = {};
      const collectionResults: DeleteCollectionResult[] = [];

      for (const collectionPath of collectionsToDelete) {
        const count = dryRun
          ? await countCollection(collectionPath)
          : await deleteCollectionRecursive(collectionPath);

        deletedCollections[collectionPath] = count;

        collectionResults.push({
          collectionPath,
          deletedCount: count,
        });

        await cleanJobRef.set(
          {
            deletedCollections,
            collectionResults,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );
      }

      const deletedStorageResults: DeleteStorageResult[] = [];

      if (deleteUploadedFiles) {
        for (const prefix of STORAGE_PREFIXES_TO_DELETE) {
          const result = await deleteStoragePrefix(prefix, dryRun);
          deletedStorageResults.push(result);

          await cleanJobRef.set(
            {
              deletedStorageResults,
              updatedAt: Timestamp.now(),
            },
            { merge: true }
          );
        }
      }

      const deletedStorageFiles = deletedStorageResults.reduce(
        (sum, item) => sum + item.deletedCount,
        0
      );

      const completedAt = Timestamp.now();

      await cleanJobRef.set(
        {
          status: dryRun ? "dry_run_completed" : "completed",
          deletedCollections,
          collectionResults,
          deletedStorageResults,
          deletedStorageFiles,
          completedAt,
          updatedAt: completedAt,
        },
        { merge: true }
      );

      await db.collection("auditLogs").add({
        action: dryRun ? "database_clean_dry_run" : "database_clean_completed",
        actorUid: uid,
        actorEmail: email,
        targetUid: null,
        targetEmail: null,
        details: {
          includeBusinessData,
          deleteUploadedFiles,
          dryRun,
          deletedCollections,
          deletedStorageFiles,
          collectionResults,
          deletedStorageResults,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      logger.info("Database clean finished", {
        requestedBy: uid,
        includeBusinessData,
        deleteUploadedFiles,
        dryRun,
        deletedCollections,
        deletedStorageFiles,
      });

      return {
        ok: true,
        dryRun,
        deletedCollections,
        collectionResults,
        deletedStorageResults,
        deletedStorageFiles,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown clean database error";

      await cleanJobRef.set(
        {
          status: "failed",
          error: message,
          failedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      logger.error("Database clean failed", {
        error: message,
        requestedBy: uid,
      });

      throw new HttpsError("internal", message);
    }
  }
);