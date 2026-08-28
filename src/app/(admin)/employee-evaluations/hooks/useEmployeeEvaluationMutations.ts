"use client";

import { useState } from "react";
import toast from "react-hot-toast";

import { employeeEvaluationWorkflow } from "@/lib/domainWorkflows";

import {
  EMPLOYEE_TITLE_OPTIONS,
  numberValue,
  roleFromTitles,
} from "../lib/evaluationUtils";

import type {
  CommentDraftMap,
  CommentTone,
  DraftMap,
  EmployeeEvaluationComment,
  EmployeeEvaluationRecord,
  EmployeeTitle,
  TitleDraftMap,
} from "../types";

type MutationState = {
  savingId: string;
  snapshotId: string;
  commentSavingId: string;
};

export function useEmployeeEvaluationMutations(isAdmin: boolean) {
  const [savingId, setSavingId] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [commentSavingId, setCommentSavingId] = useState("");

  const mutationState: MutationState = {
    savingId,
    snapshotId,
    commentSavingId,
  };

  function updateDraft(
    employeeId: string,
    field: keyof EmployeeEvaluationRecord,
    value: string,
    setDrafts: React.Dispatch<React.SetStateAction<DraftMap>>
  ) {
    setDrafts((current) => {
      const draft = current[employeeId];
      if (!draft) return current;

      const nextValue =
        field === "employeeName" ||
        field === "commentsQrUrl" ||
        field === "reviewNotes"
          ? value
          : numberValue(value);

      return {
        ...current,
        [employeeId]: {
          ...draft,
          [field]: nextValue,
        },
      };
    });
  }

  function updateTitleDraft(
    employeeId: string,
    title: string,
    setTitleDrafts: React.Dispatch<React.SetStateAction<TitleDraftMap>>
  ) {
    setTitleDrafts((current) => ({
      ...current,
      [employeeId]: (EMPLOYEE_TITLE_OPTIONS.find((t) => t === title) ?? "") as EmployeeTitle | "",
    }));
  }

  function addEmployeeTitle(
    employeeId: string,
    titleDrafts: TitleDraftMap,
    setTitleDrafts: React.Dispatch<React.SetStateAction<TitleDraftMap>>,
    drafts: DraftMap,
    setDrafts: React.Dispatch<React.SetStateAction<DraftMap>>
  ) {
    const draft = drafts[employeeId];
    if (!draft || !isAdmin) return;

    const availableTitles = EMPLOYEE_TITLE_OPTIONS.filter(
      (title) => !draft.titles.includes(title)
    );
    const nextTitle = titleDrafts[employeeId] || availableTitles[0] || "";
    if (!nextTitle) return;

    const nextTitles = Array.from(new Set([...draft.titles, nextTitle as EmployeeTitle]));
    const nextAvailableTitle =
      EMPLOYEE_TITLE_OPTIONS.find((title) => !nextTitles.includes(title)) ?? "";

    setDrafts((current) => ({
      ...current,
      [employeeId]: {
        ...draft,
        role: roleFromTitles(nextTitles, draft.role),
        titles: nextTitles,
      },
    }));
    setTitleDrafts((current) => ({
      ...current,
      [employeeId]: nextAvailableTitle as EmployeeTitle | "",
    }));
  }

  function removeEmployeeTitle(
    employeeId: string,
    titleToRemove: EmployeeTitle,
    setTitleDrafts: React.Dispatch<React.SetStateAction<TitleDraftMap>>,
    drafts: DraftMap,
    setDrafts: React.Dispatch<React.SetStateAction<DraftMap>>
  ) {
    const draft = drafts[employeeId];
    if (!draft || !isAdmin) return;

    const nextTitles = draft.titles.filter((title) => title !== titleToRemove);

    setDrafts((current) => ({
      ...current,
      [employeeId]: {
        ...draft,
        role: roleFromTitles(nextTitles, draft.role),
        titles: nextTitles,
      },
    }));
    setTitleDrafts((current) => ({
      ...current,
      [employeeId]: current[employeeId] || titleToRemove,
    }));
  }

  async function saveEmployee(
    employeeId: string,
    drafts: DraftMap
  ) {
    const draft = drafts[employeeId];
    if (!draft || !isAdmin) return;

    setSavingId(employeeId);

    try {
      await employeeEvaluationWorkflow({
        operationId: `save-${employeeId}-${Date.now()}`,
        action: "save",
        employeeId,
        employeeName: draft.employeeName,
        role: draft.role,
        titles: draft.titles,
        evaluationYear: draft.evaluationYear,
        recordAccuracy: draft.recordAccuracy,
        highDollarSales: draft.highDollarSales,
        deliveryTimeScore: draft.deliveryTimeScore,
        productivityScore: draft.productivityScore,
        deliveryAccuracy: draft.deliveryAccuracy,
        commentsQrUrl: draft.commentsQrUrl,
        reviewNotes: draft.reviewNotes,
      });

      toast.success(`${draft.employeeName} evaluation saved.`);
    } catch (error) {
      console.error("EMPLOYEE EVALUATION SAVE ERROR:", error);
      toast.error("Could not save employee evaluation.");
    } finally {
      setSavingId("");
    }
  }

  async function createSnapshot(
    employeeId: string,
    drafts: DraftMap,
    _commentsByEmployee: Record<string, EmployeeEvaluationComment[]>
  ) {
    const draft = drafts[employeeId];
    if (!draft || !isAdmin) return;

    setSnapshotId(employeeId);

    try {
      await employeeEvaluationWorkflow({
        operationId: `snapshot-${employeeId}-${Date.now()}`,
        action: "snapshot",
        employeeId,
      });

      toast.success(`${draft.employeeName} yearly evaluation snapshot saved.`);
    } catch (error) {
      console.error("EMPLOYEE SNAPSHOT ERROR:", error);
      toast.error("Could not create yearly evaluation snapshot.");
    } finally {
      setSnapshotId("");
    }
  }

  function updateCommentDraft(
    employeeId: string,
    field: "tone" | "comment",
    value: string,
    setCommentDrafts: React.Dispatch<React.SetStateAction<CommentDraftMap>>
  ) {
    setCommentDrafts((current) => {
      const currentDraft = current[employeeId] ?? {
        tone: "positive" as CommentTone,
        comment: "",
      };

      return {
        ...current,
        [employeeId]: {
          ...currentDraft,
          [field]: field === "tone" ? (value as CommentTone) : value,
        },
      };
    });
  }

  async function addManagerComment(
    employee: EmployeeEvaluationRecord,
    drafts: DraftMap,
    commentDrafts: CommentDraftMap,
    commentsByEmployee: Record<string, EmployeeEvaluationComment[]>,
    setCommentDrafts: React.Dispatch<React.SetStateAction<CommentDraftMap>>
  ) {
    const draft = commentDrafts[employee.id] ?? {
      tone: "positive" as CommentTone,
      comment: "",
    };
    const comment = draft.comment.trim();

    if (!isAdmin || !comment) return;

    setCommentSavingId(employee.id);

    try {
      await employeeEvaluationWorkflow({
        operationId: `comment-${employee.id}-${Date.now()}`,
        action: "comment",
        employeeId: employee.id,
        tone: draft.tone,
        comment,
      });

      setCommentDrafts((current) => ({
        ...current,
        [employee.id]: {
          tone: draft.tone,
          comment: "",
        },
      }));

      toast.success(`${employee.employeeName} comment added.`);
    } catch (error) {
      console.error("EMPLOYEE COMMENT SAVE ERROR:", error);
      toast.error("Could not add evaluation comment.");
    } finally {
      setCommentSavingId("");
    }
  }

  return {
    mutationState,
    updateDraft,
    updateTitleDraft,
    addEmployeeTitle,
    removeEmployeeTitle,
    saveEmployee,
    createSnapshot,
    updateCommentDraft,
    addManagerComment,
  };
}
