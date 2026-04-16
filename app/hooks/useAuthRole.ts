"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type Role = "admin" | "staff" | null;

export function useAuthRole() {
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubRole: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubRole) {
        try {
          unsubRole();
        } catch {}
        unsubRole = null;
      }

      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      unsubRole = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          if (!snap.exists()) {
            setRole(null);
            setLoading(false);
            return;
          }

          const data = snap.data();
          setRole((data?.role as Role) ?? null);
          setLoading(false);
        },
        (error) => {
          console.error("useAuthRole snapshot error:", error);
          setRole(null);
          setLoading(false);

          if (unsubRole) {
            try {
              unsubRole();
            } catch {}
            unsubRole = null;
          }
        }
      );
    });

    return () => {
      try {
        unsubAuth();
      } catch {}

      if (unsubRole) {
        try {
          unsubRole();
        } catch {}
      }
    };
  }, []);

  return {
    role,
    isAdmin: role === "admin",
    isStaff: role === "staff" || role === "admin",
    loading,
  };
}