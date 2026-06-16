import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

const db = getFirestore();

type QrCardRecord = {
  id: string;
  cardLabel?: string;
  assignedEmployee?: string;
  cardSource?: string;
  status?: string;
  targetUrl?: string;
};

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? "").trim();
  }

  return String(value ?? "").trim();
}

async function findCard(cardId: string): Promise<QrCardRecord | null> {
  if (!cardId) return null;

  const directSnap = await db.collection("qrCards").doc(cardId).get();
  if (directSnap.exists) {
    return {
      id: directSnap.id,
      ...directSnap.data(),
    } as QrCardRecord;
  }

  const slugSnap = await db
    .collection("qrCards")
    .where("cardSlug", "==", cardId)
    .limit(1)
    .get();

  if (slugSnap.empty) return null;

  const docSnap = slugSnap.docs[0];
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as QrCardRecord;
}

export const trackQrScan = onRequest(
  {
    region: "us-central1",
    cors: true,
  },
  async (request, response) => {
    const cardId =
      firstQueryValue(request.query.cardId) ||
      firstQueryValue(request.query.card) ||
      firstQueryValue(request.query.slug);

    const card = await findCard(cardId);

    if (!card || !card.targetUrl) {
      response.status(404).send("QR card not found.");
      return;
    }

    if (card.status === "paused" || card.status === "retired") {
      response.status(410).send("QR card is not active.");
      return;
    }

    try {
      await db.collection("qrScanEvents").add({
        cardId: card.id,
        cardLabel: card.cardLabel ?? "",
        assignedEmployee: card.assignedEmployee ?? "",
        source: "tracking_link",
        scannedAt: FieldValue.serverTimestamp(),
        scanCountImported: 1,
        requestMethod: request.method,
        userAgent: request.headers["user-agent"] ?? "",
        referer: request.headers.referer ?? "",
        query: request.query,
        createdAt: FieldValue.serverTimestamp(),
      });

      await db.collection("qrCards").doc(card.id).set(
        {
          scanCount: FieldValue.increment(1),
          lastScannedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      logger.error("QR scan logging failed", {
        cardId: card.id,
        error: error instanceof Error ? error.message : error,
      });
    }

    if (request.method === "POST") {
      response.status(200).json({
        ok: true,
        cardId: card.id,
      });
      return;
    }

    response.redirect(302, card.targetUrl);
  }
);
