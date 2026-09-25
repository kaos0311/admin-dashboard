"use client";

import { Award, BadgeCheck } from "lucide-react";

import { tiles, typography } from "@/theme";

import { EmptyState } from "../shared/EmptyState";
import { GlassPanel } from "../shared/GlassPanel";
import { useEmployeeEvaluationsData } from "../hooks/useEmployeeEvaluationsData";
import { useEmployeeEvaluationMutations } from "../hooks/useEmployeeEvaluationMutations";
import { EmployeeEvaluationCard } from "./EmployeeEvaluationCard";

export function EmployeeEvaluationSection({ isAdmin }: { isAdmin: boolean }) {
  const {
    records,
    drafts,
    setDrafts,
    commentDrafts,
    setCommentDrafts,
    titleDrafts,
    setTitleDrafts,
    commentsByEmployee,
  } = useEmployeeEvaluationsData();

  const {
    mutationState,
    updateDraft,
    updateTitleDraft,
    addEmployeeTitle,
    removeEmployeeTitle,
    saveEmployee,
    createSnapshot,
    updateCommentDraft,
    addManagerComment,
  } = useEmployeeEvaluationMutations(isAdmin);

  return (
    <GlassPanel
      title="Employee Evaluation Records"
      icon={<Award className="h-5 w-5" />}
    >
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className={["flex items-center gap-2", typography.bodyStrong].join(" ")}>
          <BadgeCheck className="h-4 w-4 shrink-0 text-cyan-200" />
          Yearly Review Ready
        </p>
        <p className={["mt-2", typography.bodyMuted].join(" ")}>
          Scores compile into employee records for annual evaluations. Assign one
          or more work areas to each employee, then the score fields adjust to the
          selected titles.
        </p>
        {!isAdmin ? (
          <p className={["mt-2", typography.smallMuted].join(" ")}>
            Admin access is required to edit or snapshot employee evaluation records.
          </p>
        ) : null}
      </div>

      <div className={tiles.gridTwo}>
        {records.length ? (
          records.map((employee) => (
            <EmployeeEvaluationCard
              key={employee.id}
              employee={employee}
              drafts={drafts}
              setDrafts={setDrafts}
              titleDrafts={titleDrafts}
              setTitleDrafts={setTitleDrafts}
              commentDrafts={commentDrafts}
              setCommentDrafts={setCommentDrafts}
              commentsByEmployee={commentsByEmployee}
              mutations={{
                updateDraft,
                updateTitleDraft,
                addEmployeeTitle,
                removeEmployeeTitle,
                saveEmployee,
                createSnapshot,
                updateCommentDraft,
                addManagerComment,
              }}
              isAdmin={isAdmin}
              savingId={mutationState.savingId}
              snapshotId={mutationState.snapshotId}
              commentSavingId={mutationState.commentSavingId}
            />
          ))
        ) : (
          <EmptyState text="No employee evaluation records loaded." />
        )}
      </div>
    </GlassPanel>
  );
}
