"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import toast from "react-hot-toast";

import { auth } from "@/lib/firebase";
import { badges, buttons, forms, glass, typography } from "@/theme";

function getSafeNextPath(rawNext: string | null): string {
  if (!rawNext) return "/dashboard";
  if (!rawNext.startsWith("/")) return "/dashboard";
  if (rawNext.startsWith("//")) return "/dashboard";

  try {
    const decoded = decodeURIComponent(rawNext);

    if (!decoded.startsWith("/")) return "/dashboard";
    if (decoded.startsWith("//")) return "/dashboard";
    if (decoded.includes("://")) return "/dashboard";

    return decoded;
  } catch {
    return "/dashboard";
  }
}

function getFriendlyAuthError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;

    const messages: Record<string, string> = {
      "auth/invalid-email": "That email address is not valid.",
      "auth/user-disabled": "This account has been disabled.",
      "auth/user-not-found": "No account was found for that email.",
      "auth/wrong-password": "The password is incorrect.",
      "auth/invalid-credential": "Invalid email or password.",
      "auth/too-many-requests":
        "Too many failed login attempts. Try again later.",
      "auth/network-request-failed":
        "Network error. Check your connection and try again.",
    };

    return messages[code] ?? "Login failed. Check your credentials and try again.";
  }

  return "Login failed. Check your credentials and try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectedRef = useRef(false);

  const [checkingUser, setCheckingUser] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const nextPath = useMemo(() => {
    return getSafeNextPath(searchParams.get("next"));
  }, [searchParams]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && !redirectedRef.current) {
        redirectedRef.current = true;
        router.replace(nextPath);
        return;
      }

      setCheckingUser(false);
    });

    return () => unsub();
  }, [router, nextPath]);

  const handleLogin = useCallback(async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      toast.error("Email and password are required.");
      return;
    }

    if (submitting) return;

    setSubmitting(true);

    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      toast.success("Signed in.");
    } catch (error: unknown) {
      console.error("LOGIN ERROR:", error);
      toast.error(getFriendlyAuthError(error));
      setSubmitting(false);
    }
  }, [email, password, submitting]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await handleLogin();
    },
    [handleLogin]
  );

  if (checkingUser) {
    return (
      <div className={glass.pageCenter}>
        <div className={glass.loadingCard}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <main className={glass.pageCenter}>
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className={glass.authCard}
      >
        <div className="space-y-1">
          <div className={badges.neutral}>Admin Access</div>

          <h1 className={typography.sectionTitle}>Sign in</h1>

          <p className={typography.bodyMuted}>
            Access the Advanced Home Medical admin dashboard.
          </p>
        </div>

        <div className="space-y-4">
          <div className={forms.field}>
            <label htmlFor="login-email" className={forms.label}>
              Email
            </label>

            <div className="relative">
              <Mail
                className={glass.inputIcon}
                aria-hidden={true}
              />

              <input
                id="login-email"
                name="email"
                type="email"
                title="Email address"
                aria-label="Email address"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                disabled={submitting}
                className={forms.inputIconLeft}
              />
            </div>
          </div>

          <div className={forms.field}>
            <label htmlFor="login-password" className={forms.label}>
              Password
            </label>

            <div className="relative">
              <Lock
                className={glass.inputIcon}
                aria-hidden={true}
              />

              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                title="Password"
                aria-label="Password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                disabled={submitting}
                className={forms.inputIconBoth}
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                disabled={submitting}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                className={buttons.iconInline}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden={true} />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden={true} />
                )}
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={buttons.fullPrimary}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </form>
    </main>
  );
}

