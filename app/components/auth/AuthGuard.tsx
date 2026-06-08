"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ShieldAlert } from "lucide-react";

import { auth, db } from "@/lib/firebase";

type AllowedRole = "admin" | "staff";
type ResolvedRole = AllowedRole | null;

type AuthGuardProps = {
  children: ReactNode;
  allow: AllowedRole[];
  fallback?: ReactNode;
  loadingMessage?: string;
};

type GuardState = "checking" | "authorized" | "signedOut" | "forbidden" | "error";

function parseRole(value: unknown): ResolvedRole {
  return value === "admin" || value === "staff" ? value : null;
}

export default function AuthGuard({
  children,
  allow,
  fallback,
  loadingMessage = "Checking permissions...",
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [guardState, setGuardState] = useState<GuardState>("checking");
  const [message, setMessage] = useState("");

  const redirectedRef = useRef(false);
  const allowKey = useMemo(() => allow.join("|"), [allow]);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setGuardState("checking");
      setMessage("");

      try {
        if (!user) {
          if (!cancelled) {
            setGuardState("signedOut");
            setMessage("No signed-in user was found.");
          }

          if (!redirectedRef.current) {
            redirectedRef.current = true;
            router.replace(
              `/login?next=${encodeURIComponent(pathname || "/dashboard")}`
            );
          }

          return;
        }

        let resolvedRole: ResolvedRole = null;

        const token = await user.getIdTokenResult(true);
        resolvedRole = parseRole(token.claims.role);

        const userSnap = await getDoc(doc(db, "users", user.uid));

        if (userSnap.exists()) {
          const data = userSnap.data() as Record<string, unknown>;

          if (data.active === false) {
            await auth.signOut();

            if (!cancelled) {
              setGuardState("forbidden");
              setMessage("This account is inactive.");
            }

            router.replace("/login");
            return;
          }

          const dbRole = parseRole(data.role);
          if (dbRole) resolvedRole = dbRole;
        }

        const allowedRoles = allowKey.split("|") as AllowedRole[];

        if (!resolvedRole || !allowedRoles.includes(resolvedRole)) {
          if (!cancelled) {
            setGuardState("forbidden");
            setMessage(
              resolvedRole
                ? `Your role "${resolvedRole}" is not allowed here.`
                : "No admin/staff role was found on your account."
            );
          }

          return;
        }

        redirectedRef.current = false;

        if (!cancelled) setGuardState("authorized");
      } catch (error) {
        console.error("AUTH GUARD ERROR:", error);

        if (!cancelled) {
          setGuardState("error");
          setMessage("Auth guard failed while checking access.");
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [allowKey, pathname, router]);

  if (guardState === "checking") {
    return (
      <>
        {fallback ?? (
          <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4 text-white">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] px-6 py-4 text-sm text-zinc-300 shadow-2xl shadow-black/30 backdrop-blur-2xl">
              {loadingMessage}
            </div>
          </div>
        )}
      </>
    );
  }

  if (guardState !== "authorized") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d] p-6 text-white">
        <section className="w-full max-w-md rounded-3xl border border-red-500/20 bg-red-950/20 p-8 text-red-200 shadow-2xl shadow-black/40">
          <div className="flex gap-4">
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>

            <div>
              <h1 className="text-xl font-semibold text-white">
                Access blocked
              </h1>

              <p className="mt-2 text-sm leading-6">
                {message || "You are not authorized to view this page."}
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}



