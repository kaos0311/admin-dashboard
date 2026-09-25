"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Loader2, ShieldAlert } from "lucide-react";

import { auth, db } from "@/lib/firebase";
import {
  clearSessionCookie,
  createSessionCookie,
} from "@/lib/auth/session-client";
import {
  getRoleFromUserRecord,
  isActiveUserRecord,
  isAdminRole,
  parseRole,
  resolveUserRole,
  type UserRole,
} from "@/lib/permissions/roles";
import { glass, typography } from "@/theme";

type AllowedRole = UserRole;
type ResolvedRole = UserRole | null;

type AuthGuardProps = {
  children: ReactNode;
  allow: AllowedRole[];
  fallback?: ReactNode;
  loadingMessage?: string;
};

type GuardState = "checking" | "authorized" | "signedOut" | "forbidden" | "error";

function roleIsAllowed(role: ResolvedRole, allowedRoles: AllowedRole[]): boolean {
  if (!role) return false;
  if (allowedRoles.includes(role)) return true;
  return isAdminRole(role) && allowedRoles.includes("admin");
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
          void clearSessionCookie();
          if (!cancelled) {
            setGuardState("signedOut");
            setMessage("Redirecting to sign in...");
          }

          if (!redirectedRef.current) {
            redirectedRef.current = true;
            router.replace(
              `/login?next=${encodeURIComponent(pathname || "/command-center")}`
            );
          }

          return;
        }

        let resolvedRole: ResolvedRole = null;

        const token = await user.getIdTokenResult(true);
        const tokenRole = parseRole(token.claims.role);

        const userSnap = await getDoc(doc(db, "users", user.uid));

        if (userSnap.exists()) {
          const data = userSnap.data() as Record<string, unknown>;

          if (!isActiveUserRecord(data)) {
            await clearSessionCookie();
            await auth.signOut();

            if (!cancelled) {
              setGuardState("forbidden");
              setMessage("This account is inactive.");
            }

            router.replace("/login");
            return;
          }

          const dbRole = getRoleFromUserRecord(data);
          resolvedRole = resolveUserRole({
            tokenRole,
            dbRole,
            hasUserRecord: true,
          });
        } else {
          resolvedRole = resolveUserRole({
            tokenRole,
            dbRole: null,
            hasUserRecord: false,
          });
        }

        const allowedRoles = allowKey.split("|") as AllowedRole[];

        if (!roleIsAllowed(resolvedRole, allowedRoles)) {
          if (!cancelled) {
            setGuardState("forbidden");
            setMessage(
              resolvedRole
                ? `Your role "${resolvedRole}" is not allowed here.`
                : "No command center role was found on your account."
            );
          }

          return;
        }

        // Keep the server-side session cookie in sync with the
        // authenticated sign-in state.
        void (async () => {
          try {
            const idToken = await user.getIdToken(true);
            await createSessionCookie(idToken);
          } catch (sessionError) {
            console.error("SESSION COOKIE SYNC ERROR:", sessionError);
          }
        })();

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
          <div className={glass.pageCenter}>
            <div className={glass.loadingCard}>
              {loadingMessage}
            </div>
          </div>
        )}
      </>
    );
  }

  if (guardState === "signedOut") {
    return (
      <div className={glass.pageCenter}>
        <div className={glass.loadingCard}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {message || "Redirecting to sign in..."}
        </div>
      </div>
    );
  }

  if (guardState !== "authorized") {
    return (
      <main className={`${glass.pageCenter} p-6`}>
        <section className={glass.dangerPanel}>
          <div className="flex gap-4">
            <div className={glass.alertDanger}>
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>

            <div>
              <h1 className={typography.sectionTitle}>
                Access blocked
              </h1>

              <p className={`${typography.body} mt-2`}>
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
