import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/logger";

import { requireCallableAdmin } from "../auth/roles.js";
import { enforceCallableRateLimit } from "../security/rateLimit.js";

export const PURGE_PRODUCTS_CONFIRM_TEXT = "PURGE PRODUCTS" as const;

const DELETE_BATCH_SIZE = 400;

const COLLECTION_PRODUCTS = "products" as const;

type PurgeProductsPayload = {
  confirmText?: string;
};

type CallableRequestLike = {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
};

function getPayload(data: unknown): PurgeProductsPayload {
  if (!data || typeof data !== "object") {
    return {};
  }

  return data as PurgeProductsPayload;
}

function getAuthEmail(request: CallableRequestLike): string {
  const email = request.auth?.token.email;
  return typeof email === "string" ? email : "";
}

/**
 * Admin-only, server-authoritative purge of the ENTIRE /products collection.
 *
 * Deletion authority lives exclusively on the server: the client may only
 * supply the typed confirmation text. Product documents are queried with the
 * Admin SDK and deleted in bounded batches until the collection is empty.
 */
export const purgeProducts = onCall(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async (request) => {
    await enforceCallableRateLimit(request, "admin");
    await requireCallableAdmin(
      request.auth,
      "Only admins can purge products."
    );

    const payload = getPayload(request.data);

    if (payload.confirmText !== PURGE_PRODUCTS_CONFIRM_TEXT) {
      throw new HttpsError(
        "failed-precondition",
        `Confirmation text must be exactly: ${PURGE_PRODUCTS_CONFIRM_TEXT}`
      );
    }

    const uid = request.auth!.uid;
    const email = getAuthEmail(request as CallableRequestLike);

    if (!getApps().length) {
      initializeApp();
    }

    const db = getFirestore();
    const productsRef = db.collection(COLLECTION_PRODUCTS);
    let deletedCount = 0;

    try {
      while (true) {
        const snapshot = await productsRef.limit(DELETE_BATCH_SIZE).get();

        if (snapshot.empty) break;

        const batch = db.batch();

        snapshot.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });

        await batch.commit();

        deletedCount += snapshot.size;
      }

      await db.collection("auditLogs").add({
        action: "products_purged",
        actorUid: uid,
        actorEmail: email,
        targetCollection: COLLECTION_PRODUCTS,
        deletedCount,
        createdAt: FieldValue.serverTimestamp(),
      });

      logger.info("purgeProducts completed", {
        uid,
        actorEmail: email,
        deletedCount,
      });

      return {
        status: "success" as const,
        deletedCount,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Product purge failed.";

      logger.error("purgeProducts failed", {
        uid,
        actorEmail: email,
        error: message,
        deletedCountBeforeFailure: deletedCount,
      });

      throw new HttpsError("internal", message);
    }
  }
);
