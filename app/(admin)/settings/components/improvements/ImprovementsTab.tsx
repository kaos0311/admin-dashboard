import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { Bot, Loader2, Plus, ShieldCheck, ShieldX } from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuthRole } from "@/app/hooks/useAuthRole";
import { forms, glass, typography } from "@/theme";
import type { AppSettings, ImprovementProposal, ImprovementProposalStatus } from "../../settings-types";
import { Field } from "../shared/Field";
import { SectionHeader } from "../shared/SectionHeader";

type ImprovementsTabProps = {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
};

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "ui" as ImprovementProposal["category"],
  priority: "medium" as ImprovementProposal["priority"],
  proposedChanges: "",
  estimatedImpact: "",
};

type ProposalForm = typeof EMPTY_FORM;

function statusBadgeClass(status: ImprovementProposalStatus): string {
  switch (status) {
    case "pending":
      return "border-amber-300/40 bg-amber-300/15 text-amber-100";
    case "approved":
      return "border-emerald-300/40 bg-emerald-300/15 text-emerald-100";
    case "rejected":
      return "border-red-300/40 bg-red-300/15 text-rose-100";
    case "applied":
      return "border-sky-300/40 bg-sky-300/15 text-sky-100";
    default:
      return "border-white/10 bg-white/10 text-slate-200";
  }
}

function formatTimestamp(value: unknown): string {
  if (!value) {
    return "-";
  }

  if (typeof value === "string" || typeof value === "number") {
    return new Date(value).toLocaleString();
  }

  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }

  return "-";
}

export function ImprovementsTab(_props: ImprovementsTabProps) {
  const { canAccessCommandCenter, isAdmin, isTank, user } = useAuthRole();
  const [proposals, setProposals] = useState<ImprovementProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ImprovementProposalStatus>("pending");
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [form, setForm] = useState<ProposalForm>(EMPTY_FORM);

  const canApprove = canAccessCommandCenter && (isAdmin || isTank);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const filters = query(
      collection(db, "improvementProposals"),
      where("status", "==", statusFilter),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      filters,
      (snapshot) => {
        const mapped = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as ImprovementProposal[];
        setProposals(mapped);
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Failed to listen to improvement proposals:", snapshotError);
        setError("Unable to load improvement proposals.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, statusFilter]);

  function updateField<Key extends keyof ProposalForm>(key: Key, value: ProposalForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitProposal() {
    if (!form.title.trim() || !form.description.trim()) {
      setError("Title and description are required.");
      return;
    }

    if (!["ui", "api", "data", "security", "automation", "other"].includes(form.category)) {
      setError("Invalid proposal category.");
      return;
    }

    if (!["low", "medium", "high"].includes(form.priority)) {
      setError("Invalid priority level.");
      return;
    }

    if (!user) {
      setError("Unauthenticated.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await addDoc(collection(db, "improvementProposals"), {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
        proposedChanges: form.proposedChanges?.trim() ?? "",
        estimatedImpact: form.estimatedImpact?.trim() ?? "",
        proposedByUid: user.uid,
        proposedByEmail: user.email ?? null,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setForm(EMPTY_FORM);
      setFormOpen(false);
    } catch (submitError) {
      console.error("Failed to submit improvement proposal:", submitError);
      setError("Unable to submit proposal.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id: string, action: "approve" | "reject" | "apply") {
    if (!user) {
      setError("Unauthenticated.");
      return;
    }

    if (!canApprove) {
      setError("Only administrators or tank-level users can approve or apply proposals.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const proposalRef = doc(db, "improvementProposals", id);
      const proposalSnap = await new Promise<{ exists: boolean; data: Record<string, unknown> }>((resolve, reject) => {
        const unsubscribe = onSnapshot(
          proposalRef,
          (snapshot) => {
            unsubscribe();
            resolve({ exists: snapshot.exists(), data: snapshot.data() as Record<string, unknown> });
          },
          (snapshotError) => {
            unsubscribe();
            reject(snapshotError);
          }
        );
      });

      if (!proposalSnap.exists) {
        setError("Proposal not found.");
        setLoading(false);
        return;
      }

      const proposalData = proposalSnap.data;

      if (action === "approve") {
        if (proposalData.status !== "pending") {
          setError("Only pending proposals can be approved.");
          setLoading(false);
          return;
        }

        await updateDoc(proposalRef, {
          status: "approved",
          approvedByUid: user.uid,
          approvedByEmail: user.email ?? null,
          updatedAt: serverTimestamp(),
        });
      }

      if (action === "reject") {
        if (proposalData.status !== "pending") {
          setError("Only pending proposals can be rejected.");
          setLoading(false);
          return;
        }

        if (!rejectionReason.trim()) {
          setError("Rejection reason is required.");
          setLoading(false);
          return;
        }

        await updateDoc(proposalRef, {
          status: "rejected",
          rejectionReason: rejectionReason.trim(),
          approvedByUid: user.uid,
          approvedByEmail: user.email ?? null,
          updatedAt: serverTimestamp(),
        });

        setRejectionReason("");
      }

      if (action === "apply") {
        if (proposalData.status !== "approved") {
          setError("Only approved proposals can be applied.");
          setLoading(false);
          return;
        }

        await updateDoc(proposalRef, {
          status: "applied",
          appliedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (actionError) {
      console.error("Failed to update improvement proposal:", actionError);
      setError("Unable to update proposal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={`${glass.card} p-5`}>
      <SectionHeader
        eyebrow="Jarvis Intelligence"
        title="Jarvis Improvements"
        description="Propose, review, and approve Jarvis self-improvements with explicit human approval gates."
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["pending", "approved", "rejected", "applied"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                setError(null);
              }}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition",
                statusFilter === status
                  ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100 shadow-sm shadow-cyan-200/10"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20",
              ].join(" ")}
            >
              {status}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setFormOpen((current) => !current)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200 shadow-sm backdrop-blur transition hover:border-white/20"
        >
          <Plus className="h-4 w-4" />
          New Proposal
        </button>
      </div>

      {formOpen ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <Field
              id="proposal-title"
              label="Title"
              value={form.title}
              onChange={(value) => updateField("title", value)}
              placeholder="Improvement title"
            />

            <Field
              id="proposal-category"
              label="Category"
              value={form.category}
              onChange={(value) => updateField("category", value as ProposalForm["category"])}
              placeholder="ui, api, data, security, automation, other"
            />

            <Field
              id="proposal-priority"
              label="Priority"
              value={form.priority}
              onChange={(value) => updateField("priority", value as ProposalForm["priority"])}
              placeholder="low, medium, high"
            />

            <div className="lg:col-span-2">
              <Field
                id="proposal-description"
                label="Description"
                value={form.description}
                onChange={(value) => updateField("description", value)}
                textarea
                placeholder="What should change and why?"
              />
            </div>

            <div className="lg:col-span-2">
              <Field
                id="proposal-changes"
                label="Proposed Changes"
                value={form.proposedChanges}
                onChange={(value) => updateField("proposedChanges", value)}
                textarea
                placeholder="Files, modules, or integrations touched by this change."
              />
            </div>

            <div className="lg:col-span-2">
              <Field
                id="proposal-impact"
                label="Estimated Impact"
                value={form.estimatedImpact}
                onChange={(value) => updateField("estimatedImpact", value)}
                textarea
                placeholder="Operational, safety, or compliance impact."
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 shadow-sm backdrop-blur transition hover:border-white/20"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={submitProposal}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-300/15 px-4 py-2 text-xs font-semibold text-cyan-100 shadow-sm shadow-cyan-200/10 transition hover:border-cyan-300/60 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
              Submit Proposal
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        {loading ? (
          <div className={`flex items-center gap-3 text-sm ${typography.bodyMuted}`}>
            <Loader2 className="h-5 w-5 animate-spin text-sky-200" />
            Loading proposals...
          </div>
        ) : error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : proposals.length === 0 ? (
          <p className="text-sm text-slate-400">No {statusFilter} proposals found.</p>
        ) : (
          <div className="grid gap-4">
            {proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="rounded-2xl border border-white/10 bg-black/25 p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusBadgeClass(proposal.status)}`}
                      >
                        {proposal.status}
                      </span>

                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {proposal.priority} · {proposal.category}
                      </span>
                    </div>

                    <p className={`text-base font-semibold ${typography.cardTitle}`}>
                      {proposal.title}
                    </p>

                    <p className={`text-sm leading-6 ${typography.bodyMuted}`}>
                      {proposal.description}
                    </p>

                    <div className="grid gap-2 text-xs text-slate-400">
                      <p>
                        <span className="font-semibold text-slate-300">Proposed changes:</span>{" "}
                        {proposal.proposedChanges ?? "-"}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-300">Estimated impact:</span>{" "}
                        {proposal.estimatedImpact ?? "-"}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-300">Proposed by:</span>{" "}
                        {proposal.proposedByEmail ?? proposal.proposedByUid}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-300">Created:</span>{" "}
                        {formatTimestamp(proposal.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 lg:w-40">
                    {proposal.status === "pending" && canApprove ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAction(proposal.id, "approve")}
                          disabled={loading}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-300/15 px-3 py-2 text-xs font-semibold text-emerald-100 shadow-sm shadow-emerald-200/10 transition hover:border-emerald-300/60 disabled:opacity-50"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Approve
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAction(proposal.id, "reject")}
                          disabled={loading || !rejectionReason.trim()}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300/40 bg-red-300/10 px-3 py-2 text-xs font-semibold text-rose-100 shadow-sm shadow-red-200/10 transition hover:border-red-300/60 disabled:opacity-50"
                        >
                          <ShieldX className="h-4 w-4" />
                          Reject
                        </button>

                        <textarea
                          value={rejectionReason}
                          onChange={(event) => setRejectionReason(event.target.value)}
                          placeholder="Rejection reason (required to reject)"
                          rows={2}
                          className={`${forms.textarea} mt-1 text-xs`}
                        />
                      </>
                    ) : null}

                    {proposal.status === "approved" && canApprove ? (
                      <button
                        type="button"
                        onClick={() => handleAction(proposal.id, "apply")}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-300/40 bg-sky-300/15 px-3 py-2 text-xs font-semibold text-sky-100 shadow-sm shadow-sky-200/10 transition hover:border-sky-300/60 disabled:opacity-50"
                      >
                        Apply
                      </button>
                    ) : null}

                    {proposal.status === "rejected" && proposal.rejectionReason ? (
                      <p className="text-xs text-red-300">
                        <span className="font-semibold">Rejection reason:</span> {proposal.rejectionReason}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
