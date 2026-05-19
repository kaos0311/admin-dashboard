import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "@/lib/firebase";

import type { MovementPayload } from "./inventoryTypes";

export async function logInventoryMovement(payload: MovementPayload) {
  await addDoc(collection(db, "stockMovements"), {
    ...payload,
    source: "inventory",
    createdAt: serverTimestamp(),
  });
}