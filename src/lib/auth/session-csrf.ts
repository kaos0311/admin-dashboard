export type HeaderReader = {
  get(name: string): string | null;
};

export type SessionCsrfResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "malformed" | "untrusted" | "host-mismatch" | "misconfigured" };

const TRUSTED_ORIGINS_ENV = "AUTH_TRUSTED_ORIGINS";
const TRUST_PROXY_ENV = "AUTH_TRUST_PROXY_HEADERS";

function splitHeader(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function normalizeHost(value: string | null): string | null {
  const host = splitHeader(value);
  if (!host) return null;
  if (host.includes("/") || host.includes("@")) return null;
  return host.toLowerCase();
}

function normalizeOrigin(rawOrigin: string): string | null {
  try {
    const url = new URL(rawOrigin);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return null;
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    if (url.protocol === "http:" && !isLocalhost(url.hostname)) {
      return null;
    }

    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return isLocalhost(url.hostname);
  } catch {
    return false;
  }
}

function getTrustedOrigins(): string[] | null {
  const configured = process.env[TRUSTED_ORIGINS_ENV];
  if (!configured?.trim()) {
    return process.env.NODE_ENV === "production" ? null : [];
  }

  const origins = configured
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  if (!origins.length) {
    return process.env.NODE_ENV === "production" ? null : [];
  }

  const normalized = origins.map((origin) => normalizeOrigin(origin));
  if (normalized.some((origin) => !origin)) return null;

  const uniqueOrigins = [...new Set(normalized as string[])];

  if (
    process.env.NODE_ENV === "production" &&
    uniqueOrigins.some((origin) => origin.startsWith("http://") || isLocalOrigin(origin))
  ) {
    return null;
  }

  return uniqueOrigins;
}

function shouldTrustProxyHeaders(headers: HeaderReader): boolean {
  if (process.env[TRUST_PROXY_ENV] !== "true") return false;

  const cfRay = headers.get("cf-ray");
  const cfConnectingIp = headers.get("cf-connecting-ip");
  return Boolean(cfRay || cfConnectingIp);
}

function getEffectiveRequestOrigin(headers: HeaderReader): string | null {
  const trustProxy = shouldTrustProxyHeaders(headers);
  const host = trustProxy
    ? normalizeHost(headers.get("x-forwarded-host")) ?? normalizeHost(headers.get("host"))
    : normalizeHost(headers.get("host"));

  if (!host) return null;

  const proto = trustProxy
    ? splitHeader(headers.get("x-forwarded-proto")) ?? "https"
    : process.env.NODE_ENV === "production"
      ? "https"
      : "http";

  if (proto !== "https" && proto !== "http") return null;
  if (process.env.NODE_ENV === "production" && proto !== "https") return null;

  return `${proto}://${host}`.toLowerCase();
}

export function validateSessionCsrf(headers: HeaderReader): SessionCsrfResult {
  const trustedOrigins = getTrustedOrigins();
  if (!trustedOrigins) {
    return { ok: false, reason: "misconfigured" };
  }

  const originHeader = headers.get("origin");
  if (!originHeader) {
    return { ok: false, reason: "missing" };
  }

  const requestOrigin = normalizeOrigin(originHeader);
  if (!requestOrigin) {
    return { ok: false, reason: "malformed" };
  }

  const allowedOrigins =
    process.env.NODE_ENV === "production"
      ? trustedOrigins
      : [
          ...trustedOrigins,
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "http://[::1]:3000",
        ];

  if (!allowedOrigins.includes(requestOrigin)) {
    return { ok: false, reason: "untrusted" };
  }

  const effectiveOrigin = getEffectiveRequestOrigin(headers);
  if (!effectiveOrigin) {
    return { ok: false, reason: "host-mismatch" };
  }

  if (requestOrigin !== effectiveOrigin) {
    return { ok: false, reason: "host-mismatch" };
  }

  return { ok: true };
}
