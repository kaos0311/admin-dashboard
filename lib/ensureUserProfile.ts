import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";

export async function ensureUserProfile(user: User) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      role: "staff",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await setDoc(
    userRef,
    {
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}