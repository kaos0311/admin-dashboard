"use client";

import { MessageSquarePlus } from "lucide-react";

import { badges, buttons, forms, typography } from "@/theme";

import {
  TONE_OPTIONS,
  TONE_BADGE,
  TONE_LABEL,
} from "../lib/commentUtils";

import type {
  CommentTone,
  EmployeeEvaluationComment,
  EmployeeEvaluationRecord,
} from "../types";

type Props = {
  employee: EmployeeEvaluationRecord;
  comments: EmployeeEvaluationComment[];
  commentDraft: { tone: CommentTone; comment: string };
  disabled: boolean;
  saving: boolean;
  onDraftChange: (field: "tone" | "comment", value: string) => void;
  onAddComment: () => void;
};

export function EmployeeEvaluationComments({
  employee,
  comments,
  commentDraft,
  disabled,
  saving,
  onDraftChange,
  onAddComment,
}: Props) {
  const positiveCount = comments.filter((c) => c.tone === "positive").length;
  const correctiveCount = comments.filter((c) => c.tone === "corrective").length;

  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className={["flex items-center gap-2", typography.bodyStrong].join(" ")}>
            <MessageSquarePlus className="h-4 w-4 shrink-0 text-cyan-200" />
            Running Evaluation Comments
          </p>
          <p className={["mt-1", typography.smallMuted].join(" ")}>
            Positive and corrective notes that shape the yearly evaluation.
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <span
            className={[
              "rounded-full px-2.5 py-1 text-xs font-bold",
              badges.active,
            ].join(" ")}
          >
            +{positiveCount}
          </span>
          <span
            className={[
              "rounded-full px-2.5 py-1 text-xs font-bold",
              badges.warning,
            ].join(" ")}
          >
            -{correctiveCount}
          </span>
        </div>
      </div>

      {/* ── Comment form ────────────────────────────────────────── */}
      <div className="mt-4 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
        <label className="block">
          <span className={typography.formLabel}>Comment Type</span>
          <select
            className={`${forms.select} mt-2`}
            value={commentDraft.tone}
            disabled={disabled}
            onChange={(e) => onDraftChange("tone", e.target.value)}
          >
            {TONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={typography.formLabel}>Comment</span>
          <textarea
            className={`${forms.textareaCompact} mt-2`}
            value={commentDraft.comment}
            disabled={disabled}
            rows={3}
            onChange={(e) => onDraftChange("comment", e.target.value)}
            placeholder="Add an anytime note: praise, coaching, customer feedback, sales context, delivery issue, or accuracy concern"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={
          disabled || saving || !commentDraft.comment.trim()
        }
        onClick={onAddComment}
        className={[buttons.secondary, "mt-3"].join(" ")}
      >
        <MessageSquarePlus className="h-4 w-4" />
        Add Comment
      </button>

      {/* ── Recent comments list ────────────────────────────────── */}
      <div className="mt-4 space-y-2">
        {comments.slice(0, 4).map((comment) => (
          <div
            key={comment.id}
            className="rounded-xl border border-white/10 bg-black/20 p-3"
          >
            <div className="flex min-w-0 items-center justify-between gap-3">
              <span
                className={[
                  "rounded-full px-2.5 py-1 text-xs font-bold",
                  TONE_BADGE[comment.tone],
                ].join(" ")}
              >
                {TONE_LABEL[comment.tone]}
              </span>
              <span className={typography.smallMuted}>
                {comment.createdAtLabel || "Just now"}
              </span>
            </div>
            <p className={["mt-2", typography.bodyMuted].join(" ")}>
              {comment.comment}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
