import {
  type Auth,
  type MultiFactorError,
  type MultiFactorResolver,
  type User,
  getMultiFactorResolver,
  multiFactor,
  TotpMultiFactorGenerator,
} from "firebase/auth";

export type EnrolledFactor = {
  uid: string;
  displayName: string | null;
  enrollmentTime: string | null;
  factorType: "totp" | "phone";
};

export type MfaSignInChallenge = {
  resolver: MultiFactorResolver;
  factors: EnrolledFactor[];
};

/** Get currently enrolled MFA factors for the given auth instance. */
export function getFactors(auth: Auth): EnrolledFactor[] {
  if (!auth.currentUser) return [];

  const mfaUser = multiFactor(auth.currentUser);
  return mfaUser.enrolledFactors.map((f) => ({
    uid: f.uid,
    displayName: f.displayName ?? null,
    enrollmentTime: f.enrollmentTime ?? null,
    factorType: (f.factorId === "totp" ? "totp" : "phone") as "totp" | "phone",
  }));
}

/**
 * Start TOTP enrollment for the currently signed-in user.
 * Returns an object with the secret key and a function to generate a QR code URL.
 */
export async function startEnrollment(
  auth: Auth,
): Promise<{ secretKey: string; generateQrCodeUrl: (accountName?: string, issuer?: string) => string }> {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user.");

  const mfaUser = multiFactor(user);
  const session = await mfaUser.getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);

  return {
    secretKey: secret.secretKey,
    generateQrCodeUrl: (accountName?: string, issuer?: string) =>
      secret.generateQrCodeUrl(accountName, issuer),
  };
}

/**
 * Complete TOTP enrollment by verifying a 6-digit code.
 * The secret must be the one returned from startEnrollment.
 */
export async function completeEnrollment(
  auth: Auth,
  verificationCode: string,
  displayName?: string,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user.");

  const mfaUser = multiFactor(user);
  const session = await mfaUser.getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);

  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
    secret,
    verificationCode,
  );

  await mfaUser.enroll(assertion, displayName ?? "Authenticator App");
}

/**
 * Remove an MFA factor from the current user's account.
 */
export async function unenroll(auth: Auth, factorUid: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user.");

  const mfaUser = multiFactor(user);
  await mfaUser.unenroll(factorUid);
}

/**
 * Check if an error is a Firebase MFA challenge during sign-in.
 * If so, return the resolver and list of enrolled factors for the user to choose from.
 */
export function checkMfaRequired(
  auth: Auth,
  error: unknown,
): MfaSignInChallenge | null {
  const authError = error as Record<string, unknown>;
  if (authError?.code !== "auth/multi-factor-auth-required") return null;

  try {
    const resolver = getMultiFactorResolver(
      auth,
      error as MultiFactorError,
    );
    const factors: EnrolledFactor[] = resolver.hints.map((hint) => ({
      uid: hint.uid,
      displayName: hint.displayName ?? null,
      enrollmentTime: hint.enrollmentTime ?? null,
      factorType: (hint.factorId === "totp" ? "totp" : "phone") as "totp" | "phone",
    }));
    return { resolver, factors };
  } catch {
    return null;
  }
}

/**
 * Complete MFA challenge during sign-in using a TOTP verification code.
 */
export async function resolveChallenge(
  resolver: MultiFactorResolver,
  factorUid: string,
  verificationCode: string,
): Promise<User> {
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(
    factorUid,
    verificationCode,
  );
  const cred = await resolver.resolveSignIn(assertion);
  return cred.user;
}
