/**
 * Client-only helpers for keeping the server-side session cookie in sync
 * with the Firebase Auth sign-in state.
 *
 * The server never reads the Authorization header for server components,
 * so after a successful sign-in the client exchanges a freshly minted ID
 * token for an HttpOnly session cookie at `POST /api/auth/session`.
 * On sign-out the cookie is cleared at `DELETE /api/auth/session`.
 */

const SESSION_ENDPOINT = "/api/auth/session";

/** Handles network/HTTP failures without exposing response internals. */
async function sendSessionRequest(
  method: "POST" | "DELETE",
  body?: { idToken: string },
): Promise<boolean> {
  try {
    const response = await fetch(SESSION_ENDPOINT, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    if (response.ok) return true;

    console.error(
      `SESSION ${method} FAILED: HTTP ${response.status}`,
    );
    return false;
  } catch (error) {
    console.error(`SESSION ${method} ERROR:`, error);
    return false;
  }
}

/**
 * Exchanges the current Firebase ID token for a session cookie.
 * Call immediately after sign-in / MFA resolution completes.
 */
export async function createSessionCookie(
  idToken: string,
): Promise<boolean> {
  return sendSessionRequest("POST", { idToken });
}

/** Clears the session cookie. Call before or after Firebase signOut. */
export async function clearSessionCookie(): Promise<boolean> {
  return sendSessionRequest("DELETE");
}
