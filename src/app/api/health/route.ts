import { NextResponse } from "next/server";

import { checkFirebaseHealth } from "@/lib/health/firebaseProbe";

/**
 * GET /api/health — lightweight health probe.
 *
 * Response contract (audit §12):
 * - Contains ONLY non-sensitive operational metadata: status, public version,
 *   uptime, server timestamp, and booleans/latency per service.
 * - NEVER includes: secrets, environment variables, project configuration,
 *   hostnames, filesystem paths, credentials, or any PHI/PII.
 *
 * This endpoint intentionally does not require authentication: it is a
 * public liveness/readiness check for the AHM PowerShell tooling and
 * monitoring. It exposes no data beyond the static fields below.
 */

const STARTED_AT = Date.now();

export async function GET(): Promise<NextResponse> {
  const probedAt = new Date();
  const applicationHealthy = true;
  const firebase = await checkFirebaseHealth();

  return NextResponse.json(
    {
      status: applicationHealthy && firebase.healthy ? "healthy" : "degraded",
      version: "0.1.0",
      uptime: Math.floor((probedAt.getTime() - STARTED_AT) / 1000),
      timestamp: probedAt.toISOString(),
      services: {
        application: applicationHealthy,
        firebase: firebase.healthy,
        firebaseLatencyMs: firebase.latencyMs ?? null,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
