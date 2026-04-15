"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export function useAuthRole() {
  const [role, setRole] = useState<"admin" | "staff" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      unsubscribeSnapshot = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          setRole((snap.data()?.role as "admin" | "staff") || "staff");
          setLoading(false);
        },
        () => {
          setRole(null);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  return {
    role,
    isAdmin: role === "admin",
    isStaff: role === "staff",
    loading,
  };
}