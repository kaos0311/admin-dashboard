"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import toast from "react-hot-toast";

import { auth } from "@/lib/firebase";

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
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-neutral-950 px-6 py-4 text-sm text-zinc-300 shadow-2xl shadow-black/30">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl shadow-black/40"
      >
        <div className="space-y-1">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
            Admin Access
          </div>

          <h1 className="pt-2 text-2xl font-bold tracking-tight">
            Sign in
          </h1>

          <p className="text-sm text-zinc-400">
            Access the Advanced Home Medical admin dashboard.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Email
            </label>

            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

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
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 pl-11 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Password
            </label>

            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

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
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                disabled={submitting}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 rounded-lg p-2 text-zinc-400 transition -translate-y-1/2 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white px-4 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
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