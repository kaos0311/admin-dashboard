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
import { Eye, EyeOff, KeyRound, Loader2, Lock, Mail, Smartphone } from "lucide-react";
import toast from "react-hot-toast";

import { auth } from "@/lib/firebase";
import { checkMfaRequired, resolveChallenge, type MfaSignInChallenge } from "@/lib/auth/mfa";
import Link from "next/link";
import { badges, buttons, forms, glass, typography } from "@/theme";

function getSafeNextPath(rawNext: string | null): string {
  if (!rawNext) return "/command-center";
  if (!rawNext.startsWith("/")) return "/command-center";
  if (rawNext.startsWith("//")) return "/command-center";

  try {
    const decoded = decodeURIComponent(rawNext);

    if (!decoded.startsWith("/")) return "/command-center";
    if (decoded.startsWith("//")) return "/command-center";
    if (decoded.includes("://")) return "/command-center";

    return decoded;
  } catch {
    return "/command-center";
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

  // MFA challenge state
  const [mfaChallenge, setMfaChallenge] = useState<MfaSignInChallenge | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [resolvingMfa, setResolvingMfa] = useState(false);

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
      // Check if this is an MFA challenge
      const challenge = checkMfaRequired(auth, error);
      if (challenge) {
        setMfaChallenge(challenge);
        setMfaCode("");
        setSubmitting(false);
        return;
      }

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

  const handleMfaSubmit = useCallback(async () => {
    const code = mfaCode.trim();
    if (!code || code.length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app.");
      return;
    }

    if (!mfaChallenge) return;

    setResolvingMfa(true);

    try {
      const factorUid = mfaChallenge.factors[0]?.uid;
      if (!factorUid) {
        toast.error("No MFA factor found for this account.");
        setResolvingMfa(false);
        return;
      }

      await resolveChallenge(mfaChallenge.resolver, factorUid, code);
      toast.success("Signed in.");
      // The onAuthStateChanged listener will redirect
    } catch (error) {
      console.error("MFA CHALLENGE ERROR:", error);
      toast.error(getFriendlyAuthError(error));
      setResolvingMfa(false);
    }
  }, [mfaCode, mfaChallenge]);

  const handleCancelMfa = useCallback(() => {
    setMfaChallenge(null);
    setMfaCode("");
  }, []);

  if (checkingUser) {
    return (
      <div className={glass.pageCenter}>
        <div className={glass.loadingCard}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading command center...
        </div>
      </div>
    );
  }

  /* -------------------------- MFA CHALLENGE SCREEN ------------------------- */

  if (mfaChallenge) {
    return (
      <main className={glass.pageCenter}>
        <div className={glass.authCard}>
          <div className="space-y-1">
            <div className={badges.info}>
              <Smartphone className="h-3.5 w-3.5" />
              Second Factor Required
            </div>

            <h1 className={typography.sectionTitle}>Verification code</h1>

            <p className={typography.bodyMuted}>
              This account requires a one-time code from your authenticator app
              to complete sign-in.
            </p>
          </div>

          <div className="space-y-4 mt-6">
            <div className={forms.field}>
              <label htmlFor="mfa-challenge-code" className={forms.label}>
                Authentication code
              </label>

              <div className="relative">
                <KeyRound
                  className={glass.inputIcon}
                  aria-hidden={true}
                />

                <input
                  id="mfa-challenge-code"
                  name="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  title="Enter the 6-digit code from your authenticator app"
                  aria-label="Authentication code"
                  value={mfaCode}
                  onChange={(e) =>
                    setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  maxLength={6}
                  disabled={resolvingMfa}
                  className={`${forms.inputIconLeft} font-mono text-center text-lg tracking-[0.25em]`}
                />
              </div>
            </div>

            {mfaChallenge.factors.length > 0 ? (
              <p className={`text-xs ${typography.bodyFaint}`}>
                Using: {mfaChallenge.factors[0]?.displayName ?? "Authenticator App"}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleMfaSubmit}
              disabled={resolvingMfa || mfaCode.length !== 6}
              className={buttons.fullPrimary}
            >
              {resolvingMfa ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Sign In"
              )}
            </button>

            <button
              type="button"
              onClick={handleCancelMfa}
              disabled={resolvingMfa}
              className={buttons.secondary}
            >
              Cancel
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -------------------------- NORMAL LOGIN SCREEN ------------------------- */

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
            Access the Advanced Home Medical command center.
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

        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-xs font-semibold tracking-wide text-[#888888] underline-offset-2 hover:text-[#9aba7e] hover:underline transition-colors"
            tabIndex={0}
          >
            Forgot password?
          </Link>
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
