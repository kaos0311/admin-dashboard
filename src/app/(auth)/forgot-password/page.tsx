"use client";

import {
  type FormEvent,
  useCallback,
  useState,
} from "react";

import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import toast from "react-hot-toast";

import { auth } from "@/lib/firebase";
import { badges, buttons, forms, glass, typography } from "@/theme";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedEmail = email.trim();

      if (!trimmedEmail) {
        toast.error("Please enter your email address.");
        return;
      }

      if (submitting) return;

      setSubmitting(true);

      try {
        await sendPasswordResetEmail(auth, trimmedEmail);

        // Generic success — never reveal whether the account exists.
        setSent(true);
      } catch (error: unknown) {
        // Even on error, show a generic message to prevent account enumeration.
        // Firebase throws auth/user-not-found for unknown emails, but we mask it.
        console.error("PASSWORD RESET ERROR (masked):", error);
        setSent(true);
      } finally {
        setSubmitting(false);
      }
    },
    [email, submitting]
  );

  return (
    <main className={glass.pageCenter}>
      <div className={glass.authCard}>
        <div className="space-y-1">
          <div className={badges.neutral}>Password Reset</div>

          <h1 className={typography.sectionTitle}>Forgot password</h1>

          <p className={typography.bodyMuted}>
            Enter the email address associated with your account and we'll
            send a recovery link.
          </p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className={glass.alertInfo}>
              If an account exists for that email, we've sent a password
              reset link. Please check your inbox and follow the instructions.
            </div>

            <Link
              href="/login"
              className={`${buttons.fullPrimary} no-underline`}
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="space-y-4"
          >
            <div className={forms.field}>
              <label htmlFor="reset-email" className={forms.label}>
                Email
              </label>

              <div className="relative">
                <Mail
                  className={glass.inputIcon}
                  aria-hidden={true}
                />

                <input
                  id="reset-email"
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

            <button
              type="submit"
              disabled={submitting}
              className={buttons.fullPrimary}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </button>

            <Link
              href="/login"
              className={`${buttons.fullPrimary} no-underline`}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
