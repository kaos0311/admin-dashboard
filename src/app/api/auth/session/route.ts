import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebaseAdmin";
import { validateSessionCsrf } from "@/lib/auth/session-csrf";
import {
  resolveSessionUser,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";
import { parseRole } from "@/lib/permissions/roles";
import { enforceRateLimit } from "@/lib/security/rate-limit";

type IdTokenPayload = {
  idToken?: unknown;
};

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function csrfFailureResponse(): NextResponse {
  return jsonError("Forbidden", 403);
}

function clearSessionResponse(): NextResponse {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function POST(request: Request): Promise<NextResponse> {
  const rateLimit = await enforceRateLimit({
    request,
    policyName: "session",
    scope: "ip",
  });
  if (rateLimit) return rateLimit;

  const csrf = validateSessionCsrf(request.headers);
  if (!csrf.ok) {
    return csrfFailureResponse();
  }

  let body: IdTokenPayload;

  try {
    body = (await request.json()) as IdTokenPayload;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const idToken = typeof body.idToken === "string" ? body.idToken : "";

  if (!idToken) {
    return jsonError("Missing auth token", 401);
  }

  let decoded: { uid?: string; email?: string | null; role?: unknown };

  try {
    decoded = await adminAuth.verifyIdToken(idToken, true);
  } catch {
    return jsonError("Invalid auth token", 401);
  }

  if (!decoded.uid) {
    return jsonError("Invalid auth token", 401);
  }

  const userRateLimit = await enforceRateLimit({
    request,
    policyName: "login",
    scope: "user",
    identifier: decoded.uid,
  });
  if (userRateLimit) return userRateLimit;

  const user = await resolveSessionUser({
    uid: decoded.uid,
    decodedEmail: decoded.email ?? null,
    tokenRole: parseRole(decoded.role),
  });

  if (!user) {
    return jsonError("Forbidden", 403);
  }

  let sessionCookie: string;

  try {
    sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });
  } catch {
    return jsonError("Invalid auth token", 401);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const csrf = validateSessionCsrf(request.headers);
  if (!csrf.ok) {
    return csrfFailureResponse();
  }

  return clearSessionResponse();
}
