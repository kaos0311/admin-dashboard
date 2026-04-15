import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type EnsureUserProfileInput = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

export async function ensureUserProfile(user: EnsureUserProfileInput) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      role: "staff",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const data = snap.data();

  const updates: Record<string, unknown> = {};
  let needsUpdate = false;

  if (typeof data.email !== "string") {
    updates.email = user.email ?? "";
    needsUpdate = true;
  }

  if (typeof data.displayName !== "string") {
    updates.displayName = user.displayName ?? "";
    needsUpdate = true;
  }

  if (typeof data.role !== "string") {
    updates.role = "staff";
    needsUpdate = true;
  }

  if (!("createdAt" in data)) {
    updates.createdAt = serverTimestamp();
    needsUpdate = true;
  }

  if (!("updatedAt" in data)) {
    updates.updatedAt = serverTimestamp();
    needsUpdate = true;
  }

  if (needsUpdate) {
    updates.updatedAt = serverTimestamp();
    await setDoc(userRef, updates, { merge: true });
  }
}