"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  Award,
  BadgeCheck,
  ClipboardCheck,
  MessageSquarePlus,
  Plus,
  QrCode,
  Save,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import { auth, db } from "@/lib/firebase";
import { badges, buttons, forms, tiles, typography } from "@/theme";

import { EmptyState } from "../../shared/EmptyState";
import { GlassPanel } from "../../shared/GlassPanel";

type EmployeeRole = "front_office" | "tech";
type EmployeeTitle =
  | "Manager"
  | "Retail Specialist"
  | "Auditor"
  | "Delivery Tech"
  | "IT Support"
  | "Inventory Specialist"
  | "CPAP Specialist"
  | "Hospice Specialist";

type EmployeeEvaluationRecord = {
  id: string;
  employeeName: string;
  role: EmployeeRole;
  titles: EmployeeTitle[];
  evaluationYear: number;
  recordAccuracy: number;
  highDollarSales: number;
  deliveryTimeScore: number;
  productivityScore: number;
  deliveryAccuracy: number;
  commentsQrUrl: string;
  reviewNotes: string;
  lastSnapshotAt?: unknown;
};

type DraftMap = Record<string, EmployeeEvaluationRecord>;
type CommentTone = "positive" | "corrective" | "neutral";

type EmployeeEvaluationComment = {
  id: string;
  employeeId: string;
  employeeName: string;
  tone: CommentTone;
  comment: string;
  createdAtLabel: string;
  createdByEmail: string;
};

type CommentDraftMap = Record<string, { tone: CommentTone; comment: string }>;
type TitleDraftMap = Record<string, EmployeeTitle | "">;

const EMPLOYEE_TITLE_OPTIONS: EmployeeTitle[] = [
  "Manager",
  "Retail Specialist",
  "Auditor",
  "Delivery Tech",
  "IT Support",
  "Inventory Specialist",
  "CPAP Specialist",
  "Hospice Specialist",
];

const TITLE_METRIC_FIELDS: Record<
  EmployeeTitle,
  Array<
    | "recordAccuracy"
    | "highDollarSales"
    | "deliveryTimeScore"
    | "productivityScore"
    | "deliveryAccuracy"
  >
> = {
  Manager: [
    "recordAccuracy",
    "highDollarSales",
    "deliveryTimeScore",
    "productivityScore",
    "deliveryAccuracy",
  ],
  "Retail Specialist": ["recordAccuracy", "highDollarSales", "productivityScore"],
  Auditor: ["recordAccuracy", "deliveryAccuracy"],
  "Delivery Tech": ["deliveryTimeScore", "productivityScore", "deliveryAccuracy"],
  "IT Support": ["deliveryTimeScore", "productivityScore", "recordAccuracy"],
  "Inventory Specialist": ["recordAccuracy", "productivityScore", "deliveryAccuracy"],
  "CPAP Specialist": ["recordAccuracy", "highDollarSales", "productivityScore"],
  "Hospice Specialist": ["recordAccuracy", "deliveryTimeScore", "productivityScore"],
};

const METRIC_LABELS = {
  recordAccuracy: "Record Accuracy",
  highDollarSales: "High Dollar Sales",
  deliveryTimeScore: "Delivery Response Times",
  productivityScore: "Productivity",
  deliveryAccuracy: "Accuracy",
} as const;

const DEFAULT_EMPLOYEES: EmployeeEvaluationRecord[] = [
  {
    id: "kelci",
    employeeName: "Kelci",
    role: "front_office",
    titles: ["Retail Specialist"],
    evaluationYear: new Date().getFullYear(),
    recordAccuracy: 0,
    highDollarSales: 0,
    deliveryTimeScore: 0,
    productivityScore: 0,
    deliveryAccuracy: 0,
    commentsQrUrl: "",
    reviewNotes: "",
  },
  {
    id: "mary",
    employeeName: "Mary",
    role: "front_office",
    titles: ["Retail Specialist"],
    evaluationYear: new Date().getFullYear(),
    recordAccuracy: 0,
    highDollarSales: 0,
    deliveryTimeScore: 0,
    productivityScore: 0,
    deliveryAccuracy: 0,
    commentsQrUrl: "",
    reviewNotes: "",
  },
  {
    id: "larry",
    employeeName: "Larry",
    role: "tech",
    titles: ["Delivery Tech"],
    evaluationYear: new Date().getFullYear(),
    recordAccuracy: 0,
    highDollarSales: 0,
    deliveryTimeScore: 0,
    productivityScore: 0,
    deliveryAccuracy: 0,
    commentsQrUrl: "",
    reviewNotes: "",
  },
  {
    id: "paul",
    employeeName: "Paul",
    role: "tech",
    titles: ["IT Support"],
    evaluationYear: new Date().getFullYear(),
    recordAccuracy: 0,
    highDollarSales: 0,
    deliveryTimeScore: 0,
    productivityScore: 0,
    deliveryAccuracy: 0,
    commentsQrUrl: "",
    reviewNotes: "",
  },
];

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeTitle(value: unknown): EmployeeTitle | null {
  const text = textValue(value);
  return EMPLOYEE_TITLE_OPTIONS.find((title) => title === text) ?? null;
}

function fallbackTitles(role: EmployeeRole): EmployeeTitle[] {
  return role === "tech" ? ["Delivery Tech"] : ["Retail Specialist"];
}

function roleFromTitles(titles: EmployeeTitle[], fallback: EmployeeRole): EmployeeRole {
  return titles.includes("Delivery Tech") ? "tech" : fallback;
}

function normalizeTitles(value: unknown, role: EmployeeRole): EmployeeTitle[] {
  if (!Array.isArray(value)) return fallbackTitles(role);

  const titles = value
    .map(normalizeTitle)
    .filter((title): title is EmployeeTitle => Boolean(title));

  return Array.from(new Set(titles)).length
    ? Array.from(new Set(titles))
    : fallbackTitles(role);
}

function normalizeRecord(
  id: string,
  value: Record<string, unknown>
): EmployeeEvaluationRecord {
  const fallback =
    DEFAULT_EMPLOYEES.find((employee) => employee.id === id) ??
    DEFAULT_EMPLOYEES[0];
  const role = value.role === "tech" ? "tech" : "front_office";

  return {
    id,
    employeeName: textValue(value.employeeName) || fallback.employeeName,
    role,
    titles: normalizeTitles(value.titles, role),
    evaluationYear: numberValue(value.evaluationYear) || new Date().getFullYear(),
    recordAccuracy: numberValue(value.recordAccuracy),
    highDollarSales: numberValue(value.highDollarSales),
    deliveryTimeScore: numberValue(value.deliveryTimeScore),
    productivityScore: numberValue(value.productivityScore),
    deliveryAccuracy: numberValue(value.deliveryAccuracy),
    commentsQrUrl: textValue(value.commentsQrUrl),
    reviewNotes: textValue(value.reviewNotes),
    lastSnapshotAt: value.lastSnapshotAt,
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function canTrackDeliveryResponseTimes(employee: EmployeeEvaluationRecord) {
  const employeeKey = employee.id.toLowerCase();
  const employeeName = employee.employeeName.toLowerCase().trim();

  return (
    employeeKey === "paul" ||
    employeeKey === "larry" ||
    employeeName === "paul" ||
    employeeName === "larry"
  );
}

function metricFields(employee: EmployeeEvaluationRecord) {
  const titles = Array.isArray(employee.titles)
    ? employee.titles
    : fallbackTitles(employee.role);
  const fields = titles.flatMap((title) => TITLE_METRIC_FIELDS[title]);
  const uniqueFields = Array.from(new Set(fields));
  const fallback =
    employee.role === "front_office"
      ? (["recordAccuracy", "highDollarSales"] as const)
      : (["deliveryTimeScore", "productivityScore", "deliveryAccuracy"] as const);
  const activeFields = (
    uniqueFields.length ? uniqueFields : Array.from(fallback)
  ).filter(
    (field) =>
      field !== "deliveryTimeScore" || canTrackDeliveryResponseTimes(employee)
  );

  return activeFields.map((field) => [field, METRIC_LABELS[field]] as const);
}

function gradeScore(employee: EmployeeEvaluationRecord) {
  const fields = metricFields(employee).map(([field]) => field);
  if (!fields.length) return 0;

  const total = fields.reduce((sum, field) => sum + numberValue(employee[field]), 0);
  return clampScore(total / fields.length);
}

function gradeLetter(score: number) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "Needs Review";
}

function gradeBadge(score: number) {
  if (score >= 85) return badges.active;
  if (score >= 70) return badges.info;
  if (score >= 60) return badges.warning;
  return badges.danger;
}

function createDraftMap(records: EmployeeEvaluationRecord[]) {
  return records.reduce<DraftMap>((map, record) => {
    map[record.id] = record;
    return map;
  }, {});
}

function buildRecordsFromSnapshot(records: EmployeeEvaluationRecord[]) {
  const map = new Map(DEFAULT_EMPLOYEES.map((employee) => [employee.id, employee]));

  for (const record of records) {
    map.set(record.id, {
      ...(map.get(record.id) ?? record),
      ...record,
    });
  }

  return Array.from(map.values());
}

function formatDateLabel(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }

  return "";
}

function commentToneBadge(tone: CommentTone) {
  if (tone === "positive") return badges.active;
  if (tone === "corrective") return badges.warning;
  return badges.info;
}

function commentToneLabel(tone: CommentTone) {
  if (tone === "positive") return "Positive";
  if (tone === "corrective") return "Corrective";
  return "Neutral";
}

export function EmployeeEvaluationSection({ isAdmin }: { isAdmin: boolean }) {
  const [records, setRecords] = useState<EmployeeEvaluationRecord[]>(DEFAULT_EMPLOYEES);
  const [drafts, setDrafts] = useState<DraftMap>(() =>
    createDraftMap(DEFAULT_EMPLOYEES)
  );
  const [comments, setComments] = useState<EmployeeEvaluationComment[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<CommentDraftMap>({});
  const [titleDrafts, setTitleDrafts] = useState<TitleDraftMap>({});
  const [savingId, setSavingId] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [commentSavingId, setCommentSavingId] = useState("");

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
        setComments(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const tone =
              data.tone === "positive" || data.tone === "corrective"
                ? data.tone
                : "neutral";

            return {
              id: docSnap.id,
              employeeId: textValue(data.employeeId),
              employeeName: textValue(data.employeeName),
              tone,
              comment: textValue(data.comment),
              createdAtLabel: formatDateLabel(data.createdAt),
              createdByEmail: textValue(data.createdByEmail),
            };
          })
        );
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

  function updateDraft(
    employeeId: string,
    field: keyof EmployeeEvaluationRecord,
    value: string
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

  function updateTitleDraft(employeeId: string, title: string) {
    setTitleDrafts((current) => ({
      ...current,
      [employeeId]: normalizeTitle(title) ?? "",
    }));
  }

  function addEmployeeTitle(employeeId: string) {
    const draft = drafts[employeeId];
    if (!draft || !isAdmin) return;

    const availableTitles = EMPLOYEE_TITLE_OPTIONS.filter(
      (title) => !draft.titles.includes(title)
    );
    const nextTitle = titleDrafts[employeeId] || availableTitles[0] || "";
    if (!nextTitle) return;

    const nextTitles = Array.from(new Set([...draft.titles, nextTitle]));
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
      [employeeId]: nextAvailableTitle,
    }));
  }

  function removeEmployeeTitle(employeeId: string, titleToRemove: EmployeeTitle) {
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

  async function saveEmployee(employeeId: string) {
    const draft = drafts[employeeId];
    if (!draft || !isAdmin) return;

    setSavingId(employeeId);

    try {
      await setDoc(
        doc(db, "employeeEvaluations", employeeId),
        {
          ...draft,
          currentGradeScore: gradeScore(draft),
          currentGradeLetter: gradeLetter(gradeScore(draft)),
          updatedByUid: auth.currentUser?.uid ?? null,
          updatedByEmail: auth.currentUser?.email ?? null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await addDoc(collection(db, "auditLogs"), {
        action: "employee_evaluation_updated",
        actorUid: auth.currentUser?.uid ?? null,
        actorEmail: auth.currentUser?.email ?? null,
        targetId: employeeId,
        targetName: draft.employeeName,
        targetCollection: "employeeEvaluations",
        details: {
          evaluationYear: draft.evaluationYear,
          gradeScore: gradeScore(draft),
          gradeLetter: gradeLetter(gradeScore(draft)),
        },
        createdAt: serverTimestamp(),
      });

      toast.success(`${draft.employeeName} evaluation saved.`);
    } catch (error) {
      console.error("EMPLOYEE EVALUATION SAVE ERROR:", error);
      toast.error("Could not save employee evaluation.");
    } finally {
      setSavingId("");
    }
  }

  async function createSnapshot(employeeId: string) {
    const draft = drafts[employeeId];
    if (!draft || !isAdmin) return;
    const employeeComments = commentsByEmployee[employeeId] ?? [];

    setSnapshotId(employeeId);

    try {
      await addDoc(collection(db, "employeeEvaluationSnapshots"), {
        ...draft,
        employeeId,
        gradeScore: gradeScore(draft),
        gradeLetter: gradeLetter(gradeScore(draft)),
        managerCommentCount: employeeComments.length,
        positiveCommentCount: employeeComments.filter(
          (comment) => comment.tone === "positive"
        ).length,
        correctiveCommentCount: employeeComments.filter(
          (comment) => comment.tone === "corrective"
        ).length,
        recentManagerComments: employeeComments.slice(0, 12).map((comment) => ({
          tone: comment.tone,
          comment: comment.comment,
          createdAtLabel: comment.createdAtLabel,
          createdByEmail: comment.createdByEmail,
        })),
        snapshotType: "yearly_evaluation",
        createdByUid: auth.currentUser?.uid ?? null,
        createdByEmail: auth.currentUser?.email ?? null,
        createdAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "employeeEvaluations", employeeId),
        {
          lastSnapshotAt: serverTimestamp(),
          lastSnapshotYear: draft.evaluationYear,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await addDoc(collection(db, "auditLogs"), {
        action: "employee_yearly_snapshot_created",
        actorUid: auth.currentUser?.uid ?? null,
        actorEmail: auth.currentUser?.email ?? null,
        targetId: employeeId,
        targetName: draft.employeeName,
        targetCollection: "employeeEvaluationSnapshots",
        details: {
          evaluationYear: draft.evaluationYear,
          gradeScore: gradeScore(draft),
          gradeLetter: gradeLetter(gradeScore(draft)),
        },
        createdAt: serverTimestamp(),
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
    value: string
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

  async function addManagerComment(employee: EmployeeEvaluationRecord) {
    const draft = commentDrafts[employee.id] ?? {
      tone: "positive" as CommentTone,
      comment: "",
    };
    const comment = draft.comment.trim();

    if (!isAdmin || !comment) return;

    setCommentSavingId(employee.id);

    try {
      await addDoc(collection(db, "employeeEvaluationComments"), {
        employeeId: employee.id,
        employeeName: employee.employeeName,
        tone: draft.tone,
        comment,
        source: "manager_manual_entry",
        createdByUid: auth.currentUser?.uid ?? null,
        createdByEmail: auth.currentUser?.email ?? null,
        createdAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "employeeEvaluations", employee.id),
        {
          latestManagerComment: comment,
          latestManagerCommentTone: draft.tone,
          latestManagerCommentAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await addDoc(collection(db, "auditLogs"), {
        action: "employee_evaluation_comment_added",
        actorUid: auth.currentUser?.uid ?? null,
        actorEmail: auth.currentUser?.email ?? null,
        targetId: employee.id,
        targetName: employee.employeeName,
        targetCollection: "employeeEvaluationComments",
        details: {
          tone: draft.tone,
          evaluationYear: employee.evaluationYear,
        },
        createdAt: serverTimestamp(),
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

  function renderEmployee(employee: EmployeeEvaluationRecord) {
    const draft = drafts[employee.id] ?? employee;
    const score = gradeScore(draft);
    const letter = gradeLetter(score);
    const disabled = !isAdmin;
    const employeeComments = commentsByEmployee[employee.id] ?? [];
    const positiveCount = employeeComments.filter(
      (comment) => comment.tone === "positive"
    ).length;
    const correctiveCount = employeeComments.filter(
      (comment) => comment.tone === "corrective"
    ).length;
    const commentDraft = commentDrafts[employee.id] ?? {
      tone: "positive" as CommentTone,
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
                updateDraft(employee.id, "employeeName", event.target.value)
              }
            />

            <div className="mt-3 flex min-h-20 content-start flex-wrap gap-2">
              {draft.titles.length ? (
                draft.titles.map((title) => (
                  <button
                    key={title}
                    type="button"
                    disabled={disabled}
                    onClick={() => removeEmployeeTitle(employee.id, title)}
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
                    updateTitleDraft(employee.id, event.target.value)
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
                onClick={() => addEmployeeTitle(employee.id)}
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
                updateDraft(employee.id, "evaluationYear", event.target.value)
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
                  updateDraft(employee.id, field, event.target.value)
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
                  updateDraft(employee.id, "commentsQrUrl", event.target.value)
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
              updateDraft(employee.id, "reviewNotes", event.target.value)
            }
            placeholder="Yearly review notes, coaching items, strengths, follow-up goals"
          />
        </label>

        <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
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
              <span className={["rounded-full px-2.5 py-1 text-xs font-bold", badges.active].join(" ")}>
                +{positiveCount}
              </span>
              <span className={["rounded-full px-2.5 py-1 text-xs font-bold", badges.warning].join(" ")}>
                -{correctiveCount}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
            <label className="block">
              <span className={typography.formLabel}>Comment Type</span>
              <select
                className={`${forms.select} mt-2`}
                value={commentDraft.tone}
                disabled={disabled}
                onChange={(event) =>
                  updateCommentDraft(employee.id, "tone", event.target.value)
                }
              >
                <option value="positive">Positive</option>
                <option value="corrective">Corrective</option>
                <option value="neutral">Neutral</option>
              </select>
            </label>

            <label className="block">
              <span className={typography.formLabel}>Comment</span>
              <textarea
                className={`${forms.textareaCompact} mt-2`}
                value={commentDraft.comment}
                disabled={disabled}
                rows={3}
                onChange={(event) =>
                  updateCommentDraft(employee.id, "comment", event.target.value)
                }
                placeholder="Add an anytime note: praise, coaching, customer feedback, sales context, delivery issue, or accuracy concern"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={disabled || commentSavingId === employee.id || !commentDraft.comment.trim()}
            onClick={() => void addManagerComment(draft)}
            className={[buttons.secondary, "mt-3"].join(" ")}
          >
            <MessageSquarePlus className="h-4 w-4" />
            Add Comment
          </button>

          <div className="mt-4 space-y-2">
            {employeeComments.slice(0, 4).map((comment) => (
              <div
                key={comment.id}
                className="rounded-xl border border-white/10 bg-black/20 p-3"
              >
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      commentToneBadge(comment.tone),
                    ].join(" ")}
                  >
                    {commentToneLabel(comment.tone)}
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

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={disabled || savingId === employee.id}
            onClick={() => void saveEmployee(employee.id)}
            className={buttons.primary}
          >
            <Save className="h-4 w-4" />
            Save Record
          </button>

          <button
            type="button"
            disabled={disabled || snapshotId === employee.id}
            onClick={() => void createSnapshot(employee.id)}
            className={buttons.secondary}
          >
            <ClipboardCheck className="h-4 w-4" />
            Yearly Snapshot
          </button>
        </div>
      </article>
    );
  }

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
          records.map(renderEmployee)
        ) : (
          <EmptyState text="No employee evaluation records loaded." />
        )}
      </div>
    </GlassPanel>
  );
}
