"use client";

import { ClipboardCheck, Plus, QrCode, Save, X } from "lucide-react";

import { badges, buttons, forms, tiles, typography } from "@/theme";

import {
  EMPLOYEE_TITLE_OPTIONS,
  gradeBadge,
  gradeLetter,
  gradeScore,
  metricFields,
} from "../lib/evaluationUtils";

import { EmployeeEvaluationComments } from "./EmployeeEvaluationComments";

import type {
  CommentDraftMap,
  DraftMap,
  EmployeeEvaluationComment,
  EmployeeEvaluationRecord,
  EmployeeTitle,
  TitleDraftMap,
} from "../types";

type Mutations = {
  updateDraft: (
    employeeId: string,
    field: keyof EmployeeEvaluationRecord,
    value: string,
    setDrafts: React.Dispatch<React.SetStateAction<DraftMap>>
  ) => void;
  updateTitleDraft: (
    employeeId: string,
    title: string,
    setTitleDrafts: React.Dispatch<React.SetStateAction<TitleDraftMap>>
  ) => void;
  addEmployeeTitle: (
    employeeId: string,
    titleDrafts: TitleDraftMap,
    setTitleDrafts: React.Dispatch<React.SetStateAction<TitleDraftMap>>,
    drafts: DraftMap,
    setDrafts: React.Dispatch<React.SetStateAction<DraftMap>>
  ) => void;
  removeEmployeeTitle: (
    employeeId: string,
    titleToRemove: EmployeeTitle,
    setTitleDrafts: React.Dispatch<React.SetStateAction<TitleDraftMap>>,
    drafts: DraftMap,
    setDrafts: React.Dispatch<React.SetStateAction<DraftMap>>
  ) => void;
  saveEmployee: (employeeId: string, drafts: DraftMap) => Promise<void>;
  createSnapshot: (
    employeeId: string,
    drafts: DraftMap,
    commentsByEmployee: Record<string, EmployeeEvaluationComment[]>
  ) => Promise<void>;
  updateCommentDraft: (
    employeeId: string,
    field: "tone" | "comment",
    value: string,
    setCommentDrafts: React.Dispatch<React.SetStateAction<CommentDraftMap>>
  ) => void;
  addManagerComment: (
    employee: EmployeeEvaluationRecord,
    drafts: DraftMap,
    commentDrafts: CommentDraftMap,
    commentsByEmployee: Record<string, EmployeeEvaluationComment[]>,
    setCommentDrafts: React.Dispatch<React.SetStateAction<CommentDraftMap>>
  ) => Promise<void>;
};

type Props = {
  employee: EmployeeEvaluationRecord;
  drafts: DraftMap;
  setDrafts: React.Dispatch<React.SetStateAction<DraftMap>>;
  titleDrafts: TitleDraftMap;
  setTitleDrafts: React.Dispatch<React.SetStateAction<TitleDraftMap>>;
  commentDrafts: CommentDraftMap;
  setCommentDrafts: React.Dispatch<React.SetStateAction<CommentDraftMap>>;
  commentsByEmployee: Record<string, EmployeeEvaluationComment[]>;
  mutations: Mutations;
  isAdmin: boolean;
  savingId: string;
  snapshotId: string;
  commentSavingId: string;
};

export function EmployeeEvaluationCard({
  employee,
  drafts,
  setDrafts,
  titleDrafts,
  setTitleDrafts,
  commentDrafts,
  setCommentDrafts,
  commentsByEmployee,
  mutations,
  isAdmin,
  savingId,
  snapshotId,
  commentSavingId,
}: Props) {
  const draft = drafts[employee.id] ?? employee;
  const score = gradeScore(draft);
  const letter = gradeLetter(score);
  const disabled = !isAdmin;
  const employeeComments = commentsByEmployee[employee.id] ?? [];
  const commentDraft = commentDrafts[employee.id] ?? {
    tone: "positive" as const,
    comment: "",
  };
  const availableTitles = EMPLOYEE_TITLE_OPTIONS.filter(
    (title) => !draft.titles.includes(title)
  );
  const selectedTitle = titleDrafts[employee.id] || availableTitles[0] || "";

  return (
    <article
      key={employee.id}
      className={[tiles.base, tiles.operational].join(" ")}
    >
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_96px] lg:items-start">
        <div className="min-w-0 flex-1">
          <p className={typography.caption}>Employee</p>
          <input
            className={`${forms.input} mt-2 w-full max-w-sm`}
            value={draft.employeeName}
            disabled={disabled}
            onChange={(event) =>
              mutations.updateDraft(employee.id, "employeeName", event.target.value, setDrafts)
            }
          />

          <div className="mt-3 flex min-h-20 content-start flex-wrap gap-2">
            {draft.titles.length ? (
              draft.titles.map((title) => (
                <button
                  key={title}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    mutations.removeEmployeeTitle(employee.id, title, setTitleDrafts, drafts, setDrafts)
                  }
                  className={[
                    "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold leading-5 transition disabled:cursor-not-allowed disabled:opacity-75",
                    badges.active,
                  ].join(" ")}
                  title={disabled ? title : `Remove ${title}`}
                >
                  {title}
                  {!disabled ? <X className="h-3 w-3" /> : null}
                </button>
              ))
            ) : (
              <span className={typography.smallMuted}>No work areas assigned.</span>
            )}
          </div>

          <div className="mt-3 grid max-w-xl gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="min-w-0 flex-1">
              <span className={typography.formLabel}>Work Area / Title</span>
              <select
                className={`${forms.select} mt-2`}
                value={selectedTitle}
                disabled={disabled || !availableTitles.length}
                onChange={(event) =>
                  mutations.updateTitleDraft(employee.id, event.target.value, setTitleDrafts)
                }
              >
                {availableTitles.length ? (
                  availableTitles.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))
                ) : (
                  <option value="">All titles added</option>
                )}
              </select>
            </label>

            <button
              type="button"
              disabled={disabled || !selectedTitle}
              onClick={() =>
                mutations.addEmployeeTitle(employee.id, titleDrafts, setTitleDrafts, drafts, setDrafts)
              }
              className={[buttons.compactSecondary, "h-12 px-4"].join(" ")}
            >
              <Plus className="h-4 w-4" />
              Add Title
            </button>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 lg:flex-col lg:items-end">
          <span className={["rounded-full px-3 py-1 text-sm font-bold leading-5", gradeBadge(score)].join(" ")}>
            {letter}
          </span>
          <div className="text-right">
            <p className="text-2xl font-black text-white">{score}</p>
            <p className={typography.smallMuted}>Score</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <label className="block">
          <span className={typography.formLabel}>Year</span>
          <input
            className={`${forms.input} mt-2`}
            type="number"
            value={draft.evaluationYear}
            disabled={disabled}
            onChange={(event) =>
              mutations.updateDraft(employee.id, "evaluationYear", event.target.value, setDrafts)
            }
          />
        </label>

        {metricFields(draft).map(([field, label]) => (
          <label key={field} className="block">
            <span className={typography.formLabel}>{label}</span>
            <input
              className={`${forms.input} mt-2`}
              type="number"
              min="0"
              max="100"
              value={String(draft[field])}
              disabled={disabled}
              onChange={(event) =>
                mutations.updateDraft(employee.id, field, event.target.value, setDrafts)
              }
            />
          </label>
        ))}
      </div>

      <div className="mt-5 grid gap-3">
        <label className="block">
          <span className={typography.formLabel}>Comments QR Link</span>
          <div className="mt-2 flex gap-2">
            <input
              className={forms.input}
              value={draft.commentsQrUrl}
              disabled={disabled}
              onChange={(event) =>
                mutations.updateDraft(employee.id, "commentsQrUrl", event.target.value, setDrafts)
              }
              placeholder="Paste internal comments QR/card URL"
            />
            {draft.commentsQrUrl ? (
              <a
                href={draft.commentsQrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttons.secondary}
              >
                <QrCode className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </label>
      </div>

      <label className="mt-5 block">
        <span className={typography.formLabel}>Evaluation Notes</span>
        <textarea
          className={`${forms.textareaCompact} mt-2`}
          value={draft.reviewNotes}
          disabled={disabled}
          rows={3}
          onChange={(event) =>
            mutations.updateDraft(employee.id, "reviewNotes", event.target.value, setDrafts)
          }
          placeholder="Yearly review notes, coaching items, strengths, follow-up goals"
        />
      </label>

      <EmployeeEvaluationComments
        employee={employee}
        comments={employeeComments}
        commentDraft={commentDraft}
        disabled={disabled}
        saving={commentSavingId === employee.id}
        onDraftChange={(field, value) =>
          mutations.updateCommentDraft(employee.id, field, value, setCommentDrafts)
        }
        onAddComment={() =>
          void mutations.addManagerComment(draft, drafts, commentDrafts, commentsByEmployee, setCommentDrafts)
        }
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={disabled || savingId === employee.id}
          onClick={() => void mutations.saveEmployee(employee.id, drafts)}
          className={buttons.primary}
        >
          <Save className="h-4 w-4" />
          Save Record
        </button>

        <button
          type="button"
          disabled={disabled || snapshotId === employee.id}
          onClick={() => void mutations.createSnapshot(employee.id, drafts, commentsByEmployee)}
          className={buttons.secondary}
        >
          <ClipboardCheck className="h-4 w-4" />
          Yearly Snapshot
        </button>
      </div>
    </article>
  );
}
