"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import toast from "react-hot-toast";

import {
  buildRecordsFromSnapshot,
  createDraftMap,
  DEFAULT_EMPLOYEES,
  normalizeRecord,
} from "../lib/evaluationUtils";

import { normalizeCommentDoc } from "../lib/commentUtils";

import type {
  CommentDraftMap,
  DraftMap,
  EmployeeEvaluationComment,
  EmployeeEvaluationRecord,
  TitleDraftMap,
} from "../types";

export function useEmployeeEvaluationsData() {
  const [records, setRecords] = useState<EmployeeEvaluationRecord[]>(DEFAULT_EMPLOYEES);
  const [drafts, setDrafts] = useState<DraftMap>(() =>
    createDraftMap(DEFAULT_EMPLOYEES)
  );
  const [comments, setComments] = useState<EmployeeEvaluationComment[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<CommentDraftMap>({});
  const [titleDrafts, setTitleDrafts] = useState<TitleDraftMap>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "employeeEvaluations"),
      (snapshot) => {
        const nextRecords = buildRecordsFromSnapshot(
          snapshot.docs.map((docSnap) =>
            normalizeRecord(docSnap.id, docSnap.data())
          )
        );

        setRecords(nextRecords);
        setDrafts(createDraftMap(nextRecords));
      },
      (error) => {
        console.error("EMPLOYEE EVALUATIONS SNAPSHOT ERROR:", error);
        toast.error("Unable to load employee evaluation records.");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const commentsQuery = query(
      collection(db, "employeeEvaluationComments"),
      orderBy("createdAt", "desc"),
      limit(200)
    );

    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => {
        setComments(snapshot.docs.map(normalizeCommentDoc));
      },
      (error) => {
        console.error("EMPLOYEE EVALUATION COMMENTS SNAPSHOT ERROR:", error);
        toast.error("Unable to load employee evaluation comments.");
      }
    );

    return () => unsubscribe();
  }, []);

  const commentsByEmployee = useMemo(() => {
    return comments.reduce<Record<string, EmployeeEvaluationComment[]>>(
      (map, comment) => {
        map[comment.employeeId] = [...(map[comment.employeeId] ?? []), comment];
        return map;
      },
      {}
    );
  }, [comments]);

  return {
    records,
    drafts,
    setDrafts,
    comments,
    commentDrafts,
    setCommentDrafts,
    titleDrafts,
    setTitleDrafts,
    commentsByEmployee,
  };
}
