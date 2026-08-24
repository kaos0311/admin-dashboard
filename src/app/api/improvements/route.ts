import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireApiRole } from "@/lib/auth/require-api-auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function toIso(value: unknown): string {
  if (!value) {
    return new Date(0).toISOString();
  }

  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  if (typeof value === "string" || typeof value === "number") {
    return new Date(value).toISOString();
  }

  return new Date(0).toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const ipRateLimit = await enforceRateLimit({
      request,
      policyName: "general",
      scope: "ip",
    });
    if (ipRateLimit) return ipRateLimit;

    const authResult = await requireApiRole(request, ["admin", "tank"]);

    if (!authResult.ok) {
      return authResult.response;
    }

    const userRateLimit = await enforceRateLimit({
      request,
      policyName: "general",
      scope: "user",
      identifier: authResult.uid,
    });
    if (userRateLimit) return userRateLimit;

    const statusFilter = request.nextUrl.searchParams.get("status") ?? "pending";
    const snapshot = await adminDb
      .collection("improvementProposals")
      .where("status", "==", statusFilter)
      .orderBy("createdAt", "desc")
      .get();

    const proposals = snapshot.docs.map((document) => {
      const data = document.data();

      return {
        id: document.id,
        ...data,
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
        appliedAt: data.appliedAt ? toIso(data.appliedAt) : null,
      };
    });

    return NextResponse.json({ proposals });
  } catch (error) {
    console.error("Failed to load improvement proposals:", error);

    return NextResponse.json(
      { error: "Unable to load improvement proposals." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ipRateLimit = await enforceRateLimit({
      request,
      policyName: "admin",
      scope: "ip",
    });
    if (ipRateLimit) return ipRateLimit;

    const body = (await request.json()) as {
      title?: string;
      description?: string;
      category?: string;
      priority?: string;
      proposedChanges?: string;
      estimatedImpact?: string;
    };

    if (!body.title?.trim() || !body.description?.trim()) {
      return NextResponse.json(
        { error: "Title and description are required." },
        { status: 400 }
      );
    }

    if (!["ui", "api", "data", "security", "automation", "other"].includes(body.category || "")) {
      return NextResponse.json({ error: "Invalid proposal category." }, { status: 400 });
    }

    if (!["low", "medium", "high"].includes(body.priority || "")) {
      return NextResponse.json({ error: "Invalid priority level." }, { status: 400 });
    }

    const authResult = await requireApiRole(request, ["admin", "tank"]);

    if (!authResult.ok) {
      return authResult.response;
    }

    const userRateLimit = await enforceRateLimit({
      request,
      policyName: "admin",
      scope: "user",
      identifier: authResult.uid,
    });
    if (userRateLimit) return userRateLimit;

    const now = new Date();

    const proposalRef = adminDb.collection("improvementProposals").doc();
    await proposalRef.set({
      title: body.title.trim(),
      description: body.description.trim(),
      category: body.category,
      priority: body.priority,
      status: "pending",
      proposedChanges: body.proposedChanges?.trim() ?? "",
      estimatedImpact: body.estimatedImpact?.trim() ?? "",
      proposedByUid: authResult.uid,
      proposedByEmail: authResult.email ?? null,
      approvedByUid: null,
      approvedByEmail: null,
      rejectionReason: null,
      appliedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ id: proposalRef.id }, { status: 201 });
  } catch (error) {
    console.error("Failed to create improvement proposal:", error);

    return NextResponse.json(
      { error: "Unable to create improvement proposal." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ipRateLimit = await enforceRateLimit({
      request,
      policyName: "admin",
      scope: "ip",
    });
    if (ipRateLimit) return ipRateLimit;

    const body = (await request.json()) as {
      id?: string;
      action?: "approve" | "reject" | "apply";
      rejectionReason?: string;
    };

    if (!body.id) {
      return NextResponse.json({ error: "Proposal id is required." }, { status: 400 });
    }

    if (!["approve", "reject", "apply"].includes(body.action ?? "")) {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const authResult = await requireApiRole(request, ["admin", "tank"]);

    if (!authResult.ok) {
      return authResult.response;
    }

    const userRateLimit = await enforceRateLimit({
      request,
      policyName: "admin",
      scope: "user",
      identifier: authResult.uid,
    });
    if (userRateLimit) return userRateLimit;

    const proposalRef = adminDb.collection("improvementProposals").doc(body.id);
    const proposalSnap = await proposalRef.get();

    if (!proposalSnap.exists) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }

    const proposalData = proposalSnap.data() as Record<string, unknown>;

    const ts = new Date();

    if (body.action === "approve") {
      if (proposalData.status !== "pending") {
        return NextResponse.json(
          { error: "Only pending proposals can be approved." },
          { status: 400 }
        );
      }

      await proposalRef.update({
        status: "approved",
        approvedByUid: authResult.uid,
        approvedByEmail: authResult.email,
        updatedAt: ts,
      });

      return NextResponse.json({ ok: true, status: "approved" });
    }

    if (body.action === "reject") {
      if (proposalData.status !== "pending") {
        return NextResponse.json(
          { error: "Only pending proposals can be rejected." },
          { status: 400 }
        );
      }

      if (!body.rejectionReason?.trim()) {
        return NextResponse.json(
          { error: "Rejection reason is required." },
          { status: 400 }
        );
      }

      await proposalRef.update({
        status: "rejected",
        rejectionReason: body.rejectionReason.trim(),
        approvedByUid: authResult.uid,
        approvedByEmail: authResult.email,
        updatedAt: ts,
      });

      return NextResponse.json({ ok: true, status: "rejected" });
    }

    if (body.action === "apply") {
      if (proposalData.status !== "approved") {
        return NextResponse.json(
          { error: "Only approved proposals can be applied." },
          { status: 400 }
        );
      }

      await proposalRef.update({
        status: "applied",
        appliedAt: ts,
        updatedAt: ts,
      });

      return NextResponse.json({ ok: true, status: "applied" });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    console.error("Failed to update improvement proposal:", error);

    return NextResponse.json(
      { error: "Unable to update improvement proposal." },
      { status: 500 }
    );
  }
}
