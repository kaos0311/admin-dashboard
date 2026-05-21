"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type AllowedRole = "admin" | "staff";
type ResolvedRole = AllowedRole | null;

type AuthGuardProps = {
  children: ReactNode;
  allow: AllowedRole[];
  fallback?: ReactNode;
  loadingMessage?: string;
};

export default function AuthGuard({
  children,
  allow,
  fallback,
  loadingMessage = "Checking permissions...",
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const redirectedRef = useRef(false);

  const allowKey = useMemo(() => allow.join("|"), [allow]);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setChecking(true);

        if (!user) {
          if (!redirectedRef.current) {
            redirectedRef.current = true;
            router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
          }

          if (!cancelled) {
            setAuthorized(false);
            setChecking(false);
          }

          return;
        }

        let resolvedRole: ResolvedRole = null;

        try {
          const token = await user.getIdTokenResult(true);
          const tokenRole = token.claims.role;

          if (tokenRole === "admin" || tokenRole === "staff") {
            resolvedRole = tokenRole;
          }
        } catch (error) {
          console.error("TOKEN ROLE ERROR:", error);
        }

        try {
          const userSnap = await getDoc(doc(db, "users", user.uid));

          if (userSnap.exists()) {
            const data = userSnap.data() as Record<string, unknown>;

            if (data.active === false) {
              await auth.signOut();

              if (!redirectedRef.current) {
                redirectedRef.current = true;
                router.replace("/login");
              }

              if (!cancelled) {
                setAuthorized(false);
                setChecking(false);
              }

              return;
            }

            const dbRole = data.role;

            if (dbRole === "admin" || dbRole === "staff") {
              resolvedRole = dbRole;
            }
          }
        } catch (error) {
          console.error("USER DOC ROLE ERROR:", error);
        }

        const allowedRoles = allowKey.split("|") as AllowedRole[];

        if (!resolvedRole || !allowedRoles.includes(resolvedRole)) {
          if (!redirectedRef.current) {
            redirectedRef.current = true;
            router.replace("/dashboard");
          }

          if (!cancelled) {
            setAuthorized(false);
            setChecking(false);
          }

          return;
        }

        redirectedRef.current = false;

        if (!cancelled) {
          setAuthorized(true);
          setChecking(false);
        }
      } catch (error) {
        console.error("AUTH GUARD ERROR:", error);

        if (!redirectedRef.current) {
          redirectedRef.current = true;
          router.replace("/login");
        }

        if (!cancelled) {
          setAuthorized(false);
          setChecking(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [allowKey, pathname, router]);

  if (checking) {
    return (
      <>
        {fallback ?? (
          <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_34%),#020617] px-4 text-white">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] px-6 py-4 text-sm text-zinc-300 shadow-2xl shadow-black/30 backdrop-blur-2xl">
              {loadingMessage}
            </div>
          </div>
        )}
      </>
    );
  }

  if (!authorized) return null;

  return <>{children}</>;
}