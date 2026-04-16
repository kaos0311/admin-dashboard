"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

type AuthGuardProps = {
  children: ReactNode;
};

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    // Not signed in and trying to access protected pages
    if (!user && pathname !== "/login") {
      router.replace("/login");
      return;
    }

    // Signed in and trying to access login page
    if (user && pathname === "/login") {
      router.replace("/");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        Checking session...
      </div>
    );
  }

  // Block protected pages if not signed in
  if (!user && pathname !== "/login") {
    return null;
  }

  // Block login page if already signed in
  if (user && pathname === "/login") {
    return null;
  }

  return <>{children}</>;
}