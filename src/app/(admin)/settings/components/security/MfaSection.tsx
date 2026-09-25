"use client";

import { useCallback, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  KeyRound,
  Loader2,
  QrCode,
  Shield,
  ShieldOff,
  Smartphone,
} from "lucide-react";
import toast from "react-hot-toast";

import { auth } from "@/lib/firebase";
import {
  getFactors,
  type EnrolledFactor,
  startEnrollment,
  completeEnrollment,
  unenroll,
} from "@/lib/auth/mfa";
import {
  glass,
  typography,
  buttons,
  forms,
} from "@/theme";

export function MfaSection() {
  const [factors, setFactors] = useState<EnrolledFactor[]>(() =>
    getFactors(auth),
  );
  const [enrolling, setEnrolling] = useState(false);
  const [step, setStep] = useState<"idle" | "secret" | "verify">("idle");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const mfaEnabled = factors.length > 0;

  const refreshFactors = useCallback(() => {
    setFactors(getFactors(auth));
  }, []);

  const handleStartEnroll = useCallback(async () => {
    setEnrolling(true);
    setStep("secret");
    setVerificationCode("");
    setSecretKey("");

    try {
      const result = await startEnrollment(auth);
      setSecretKey(result.secretKey);
      setQrCodeUrl(
        result.generateQrCodeUrl(
          auth.currentUser?.email ?? undefined,
          "Advanced Home Medical",
        ),
      );
      setDisplayName("");
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to start enrollment.";
      toast.error(msg);
      console.error("MFA ENROLL START ERROR:", error);
      setStep("idle");
    } finally {
      setEnrolling(false);
    }
  }, []);

  const handleVerify = useCallback(async () => {
    const code = verificationCode.trim();
    if (!code || code.length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setVerifying(true);

    try {
      await completeEnrollment(
        auth,
        code,
        displayName.trim() || "Authenticator App",
      );
      toast.success("MFA enabled successfully.");
      setStep("idle");
      setVerificationCode("");
      setQrCodeUrl("");
      setSecretKey("");
      refreshFactors();
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Verification failed.";
      toast.error(msg);
      console.error("MFA VERIFY ERROR:", error);
    } finally {
      setVerifying(false);
    }
  }, [verificationCode, displayName, refreshFactors]);

  const handleUnenroll = useCallback(
    async (factorUid: string) => {
      if (
        !window.confirm(
          "Remove MFA from your account? You will no longer be prompted for a second factor on sign-in.",
        )
      ) {
        return;
      }

      setRemoving(factorUid);

      try {
        await unenroll(auth, factorUid);
        toast.success("MFA removed.");
        refreshFactors();
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Failed to remove MFA.";
        toast.error(msg);
        console.error("MFA UNENROLL ERROR:", error);
      } finally {
        setRemoving(null);
      }
    },
    [refreshFactors],
  );

  const handleCancel = useCallback(() => {
    setStep("idle");
    setQrCodeUrl("");
    setVerificationCode("");
    setSecretKey("");
  }, []);

  /* -------------------------- ENROLLMENT: SHOW QR & SECRET ------------------------- */

  if (step === "secret" || step === "verify") {
    return (
      <div className={`${glass.inset} mt-6 p-5`}>
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-2.5">
            <QrCode className="h-5 w-5 text-amber-300" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className={typography.cardTitle}>Set up Authenticator App</h3>
            <p className={`mt-1 text-sm leading-6 ${typography.bodyMuted}`}>
              Scan the QR code below with your authenticator app (Google
              Authenticator, Authy, etc.), then enter the 6-digit code to
              verify.
            </p>
          </div>
        </div>

        {step === "secret" ? (
          <>
            {qrCodeUrl ? (
              <div className="mt-5 flex justify-center">
                <div className="rounded-xl border border-white/10 bg-white p-4">
                  <img
                    src={qrCodeUrl}
                    alt="QR code for authenticator app"
                    className="h-48 w-48"
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              <p className={typography.formLabel}>Or enter this key manually</p>
              <div
                className={`mt-2 rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm tracking-wider text-cyan-200`}
              >
                {secretKey.match(/.{1,4}/g)?.join(" ") ?? secretKey}
              </div>

              <p className={`mt-3 text-xs ${typography.bodyFaint}`}>
                Your authenticator app supports scanning the QR code or pasting
                the key.
              </p>
            </div>

            <div className="mt-6">
              <label className="block" htmlFor="mfa-display-name">
                <span className={typography.formLabel}>
                  Device name (optional)
                </span>
                <input
                  id="mfa-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Work Phone"
                  className={`${forms.input} mt-2`}
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setStep("verify")}
                  className={buttons.primary}
                >
                  <KeyRound className="h-4 w-4" />
                  I have scanned the code
                </button>

                <button
                  type="button"
                  onClick={handleCancel}
                  className={buttons.secondary}
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        ) : null}

        {step === "verify" ? (
          <div className="mt-6">
            <label className="block" htmlFor="mfa-verification-code">
              <span className={typography.formLabel}>
                Enter verification code
              </span>
              <input
                id="mfa-verification-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(
                    e.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                placeholder="000000"
                maxLength={6}
                className={`${forms.input} mt-2 font-mono text-center text-lg tracking-[0.25em]`}
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying || verificationCode.length !== 6}
                className={buttons.primary}
              >
                {verifying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Verify & Enable
              </button>

              <button
                type="button"
                onClick={() => setStep("secret")}
                disabled={verifying}
                className={buttons.secondary}
              >
                Back
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /* -------------------------------- IDLE STATE ------------------------------- */

  return (
    <div className={`${glass.inset} mt-6 p-5`}>
      <SectionRow
        icon={<Shield className="h-5 w-5 text-emerald-300" />}
        title="Multi-Factor Authentication (MFA)"
        description="Add an extra layer of security with a one-time code from your authenticator app."
      />

      {mfaEnabled ? (
        <div className="mt-5 space-y-3">
          {factors.map((factor) => (
            <div
              key={factor.uid}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-cyan-300" />
                <div>
                  <p className={typography.cardTitle}>
                    {factor.displayName ?? "Authenticator App"}
                  </p>
                  <p className={`mt-0.5 text-xs ${typography.bodyMuted}`}>
                    {factor.factorType === "totp"
                      ? "TOTP (authenticator app)"
                      : "Phone SMS"}
                    {factor.enrollmentTime
                      ? ` · Enrolled ${new Date(factor.enrollmentTime).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleUnenroll(factor.uid)}
                disabled={removing === factor.uid}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {removing === factor.uid ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldOff className="h-3.5 w-3.5" />
                )}
                Remove
              </button>
            </div>
          ))}

          <p className={`mt-3 text-xs ${typography.bodyFaint}`}>
            You will be prompted for a one-time code on your next sign-in.
          </p>
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex items-center gap-3 rounded-xl border border-amber-300/20 bg-amber-400/5 p-4">
            <CircleAlert className="h-5 w-5 shrink-0 text-amber-300" />
            <p className={`text-sm ${typography.bodyMuted}`}>
              MFA is not enabled. Anyone with your password can sign in.
              Enabling MFA adds a second check using your phone or
              authenticator app.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartEnroll}
            disabled={enrolling}
            className={`${buttons.primary} mt-4`}
          >
            {enrolling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
            {enrolling ? "Starting..." : "Enable MFA"}
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SMALL HELPERS                                                              */
/* -------------------------------------------------------------------------- */

function SectionRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-2.5">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className={typography.cardTitle}>{title}</h3>
        <p className={`mt-1 text-sm leading-6 ${typography.bodyMuted}`}>
          {description}
        </p>
      </div>
    </div>
  );
}
