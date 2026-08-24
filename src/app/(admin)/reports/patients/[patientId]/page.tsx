"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  FileText,
  HeartPulse,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { patientLifecycleWorkflow } from "@/lib/domainWorkflows";
import { auth, db } from "@/lib/firebase";
import { colors, glass, typography } from "@/theme";

import { addTimelineEntry } from "../lib/patientActions";
import {
  PATIENTS_COLLECTION,
  type PatientTask,
  type PatientTaskPriority,
  type PatientTaskStatus,
} from "./patient-detail-types";
import {
  calculatePatientRisk,
  formatBirthday,
  getAgeTurning,
  getRiskFlags,
  isBirthdayThisMonth,
  isDestroyEligible,
  makeId,
} from "./patient-detail-utils";
import { usePatientDetail } from "./use-patient-detail";

import {
  ClinicalTab,
  CustomFieldsTab,
  HistoryTab,
  InsuranceTab,
  ItemsTab,
  MessagesTab,
  OrderTab,
  PatientResponsibilityTab,
  ScheduleTab,
} from "./components/PatientBrightreeTabSections";
import { PatientDetailHeader } from "./components/PatientDetailHeader";
import {
  GlassPanel,
  LoadingState,
  PageShell,
} from "./components/PatientDetailPrimitives";

type PatientRecordTab =
  | "order"
  | "clinical"
  | "insurance"
  | "patient-responsibility"
  | "items"
  | "schedule"
  | "messages"
  | "custom-fields"
  | "history";

const patientRecordTabs: Array<{
  id: PatientRecordTab;
  label: string;
  icon: ReactNode;
}> = [
  {
    id: "order",
    label: "Order",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    id: "clinical",
    label: "Clinical",
    icon: <UserRound className="h-4 w-4" />,
  },
  {
    id: "insurance",
    label: "Insurance",
    icon: <HeartPulse className="h-4 w-4" />,
  },
  {
    id: "patient-responsibility",
    label: "Patient Responsibility",
    icon: <ReceiptText className="h-4 w-4" />,
  },
  {
    id: "items",
    label: "Items",
    icon: <PackageCheck className="h-4 w-4" />,
  },
  {
    id: "schedule",
    label: "Schedule",
    icon: <CalendarClock className="h-4 w-4" />,
  },
  {
    id: "messages",
    label: "Messages",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    id: "custom-fields",
    label: "Custom Fields",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: "history",
    label: "History",
    icon: <CalendarClock className="h-4 w-4" />,
  },
];

const patientRecordTabIds = new Set<PatientRecordTab>(
  patientRecordTabs.map((tab) => tab.id)
);

function isPatientRecordTab(value: string | null): value is PatientRecordTab {
  return Boolean(value && patientRecordTabIds.has(value as PatientRecordTab));
}

function legacyTab(value: string | null): PatientRecordTab | null {
  if (value === "billing") return "patient-responsibility";
  if (value === "documents") return "custom-fields";
  if (value === "tasks") return "schedule";
  if (value === "profile") return "clinical";
  if (value === "equipment") return "items";
  if (value === "overview") return "order";

  return null;
}

export default function PatientDetailPage() {
  const params = useParams<{ patientId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientId = params.patientId;

  const { patient, loading, message, setMessage } = usePatientDetail(patientId);

  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [activeTab, setActiveTab] = useState<PatientRecordTab>("order");

  const [notesDraft, setNotesDraft] = useState("");
  const [careNotesDraft, setCareNotesDraft] = useState("");
  const [equipmentNotesDraft, setEquipmentNotesDraft] = useState("");
  const [billingNotesDraft, setBillingNotesDraft] = useState("");

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] =
    useState<PatientTaskPriority>("routine");

  useEffect(() => {
    const requestedTab = searchParams.get("tab");

    if (isPatientRecordTab(requestedTab)) {
      setActiveTab(requestedTab);
      return;
    }

    const mappedTab = legacyTab(requestedTab);

    if (mappedTab) {
      setActiveTab(mappedTab);
      return;
    }

    if (window.location.hash === "#wip") {
      setActiveTab("schedule");
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab !== "schedule" || window.location.hash !== "#wip") {
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById("wip")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [activeTab]);

  useEffect(() => {
  if (!patient) {
    setNotesDraft("");
    setCareNotesDraft("");
    setEquipmentNotesDraft("");
    setBillingNotesDraft("");
    return;
  }

  setNotesDraft(patient.notes ?? "");
  setCareNotesDraft(patient.careNotes ?? "");
  setEquipmentNotesDraft(patient.equipmentNotes ?? "");
  setBillingNotesDraft(patient.billingNotes ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    patient?.id,
  patient?.notes,
  patient?.careNotes,
  patient?.equipmentNotes,
  patient?.billingNotes,
]);

  const birthdayInfo = useMemo(() => {
    if (!patient?.dateOfBirth) return null;

    return {
      isThisMonth: isBirthdayThisMonth(patient.dateOfBirth),
      birthday: formatBirthday(patient.dateOfBirth),
      ageTurning: getAgeTurning(patient.dateOfBirth),
    };
  }, [patient]);

  const riskScore = patient ? calculatePatientRisk(patient) : 0;
  const riskFlags = patient ? getRiskFlags(patient) : [];

  const openTasks =
    patient?.tasks?.filter((task) => task.status === "open") ?? [];

  const completedTasks =
    patient?.tasks?.filter((task) => task.status === "done") ?? [];

  async function saveNotes() {
    if (!patient) return;

    setSavingNotes(true);
    setMessage("");

    try {
      await updateDoc(doc(db, PATIENTS_COLLECTION, patient.id), {
        notes: notesDraft,
        careNotes: careNotesDraft,
        equipmentNotes: equipmentNotesDraft,
        billingNotes: billingNotesDraft,
        notesUpdatedAt: serverTimestamp(),
        notesUpdatedBy: auth.currentUser?.email ?? null,
        updatedAt: serverTimestamp(),
      });

      await addTimelineEntry({
        patientId: patient.id,
        type: "notes_updated",
        title: "Internal notes updated",
        body: "General, care, equipment, or billing notes were updated from the patient detail page.",
      });

      setMessage("Patient notes saved.");
    } catch (error) {
      console.error("SAVE PATIENT NOTES ERROR:", error);
      setMessage("Could not save patient notes. Check Firestore permissions.");
    } finally {
      setSavingNotes(false);
    }
  }

  async function addTask() {
    if (!patient) return;

    const title = newTaskTitle.trim();

    if (!title) {
      setMessage("Enter a task title before saving.");
      return;
    }

    setSavingTask(true);
    setMessage("");

    try {
      const task: PatientTask = {
        id: makeId("task"),
        title,
        assignedTo: newTaskAssignedTo.trim(),
        dueDate: newTaskDueDate,
        priority: newTaskPriority,
        status: "open",
        createdBy: auth.currentUser?.email ?? null,
      };

      await updateDoc(doc(db, PATIENTS_COLLECTION, patient.id), {
        tasks: [...(patient.tasks ?? []), task],
        updatedAt: serverTimestamp(),
      });

      await addTimelineEntry({
        patientId: patient.id,
        type: "task_created",
        title: `Task created: ${title}`,
        body: task.assignedTo ? `Assigned to ${task.assignedTo}` : "",
      });

      setNewTaskTitle("");
      setNewTaskAssignedTo("");
      setNewTaskDueDate("");
      setNewTaskPriority("routine");
      setMessage("Task added.");
    } catch (error) {
      console.error("ADD PATIENT TASK ERROR:", error);
      setMessage("Could not add task. Check Firestore permissions.");
    } finally {
      setSavingTask(false);
    }
  }

  async function updateTaskStatus(
    taskId: string,
    status: PatientTaskStatus
  ) {
    if (!patient) return;

    setSavingTask(true);
    setMessage("");

    try {
      const nextTasks = (patient.tasks ?? []).map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              updatedAt: new Date().toISOString(),
            }
          : task
      );

      await updateDoc(doc(db, PATIENTS_COLLECTION, patient.id), {
        tasks: nextTasks,
        updatedAt: serverTimestamp(),
      });

      await addTimelineEntry({
        patientId: patient.id,
        type: "task_updated",
        title: status === "done" ? "Task marked complete" : "Task reopened",
      });

      setMessage(status === "done" ? "Task completed." : "Task reopened.");
    } catch (error) {
      console.error("UPDATE PATIENT TASK ERROR:", error);
      setMessage("Could not update task. Check Firestore permissions.");
    } finally {
      setSavingTask(false);
    }
  }

  async function archivePatient() {
    if (!patient) return;

    const confirmed = window.confirm(`Archive ${patient.fullName}?`);
    if (!confirmed) return;

    setSavingStatus(true);
    setMessage("");

    try {
      const result = await patientLifecycleWorkflow({
        operationId: `patient-archive-${patient.id}`,
        patientId: patient.id,
        action: "archive",
        reason: "Archived from patient detail page.",
      });
      if (result.status !== "success" && result.status !== "duplicate_operation") {
        throw new Error(result.message || "Patient archive workflow failed.");
      }

      setMessage(`${patient.fullName} moved to archived records.`);
    } catch (error) {
      console.error("ARCHIVE PATIENT ERROR:", error);
      setMessage("Could not archive patient. Check Firestore permissions.");
    } finally {
      setSavingStatus(false);
    }
  }

  async function restorePatient() {
    if (!patient) return;

    const confirmed = window.confirm(`Restore ${patient.fullName} to active?`);
    if (!confirmed) return;

    setSavingStatus(true);
    setMessage("");

    try {
      const result = await patientLifecycleWorkflow({
        operationId: `patient-restore-${patient.id}`,
        patientId: patient.id,
        action: "restore",
        reason: "Restored from patient detail page.",
      });
      if (result.status !== "success" && result.status !== "duplicate_operation") {
        throw new Error(result.message || "Patient restore workflow failed.");
      }

      setMessage(`${patient.fullName} restored to active records.`);
    } catch (error) {
      console.error("RESTORE PATIENT ERROR:", error);
      setMessage("Could not restore patient. Check Firestore permissions.");
    } finally {
      setSavingStatus(false);
    }
  }

  async function destroyPatient() {
    if (!patient) return;

    if (!isDestroyEligible(patient)) {
      setMessage(
        "This patient is not eligible for destruction yet. Records require 7 years with no equipment, billing, service, or treatment activity."
      );
      return;
    }

    const confirmed = window.confirm(
      `Destroy archived record for ${patient.fullName}?\n\nOnly continue if retention requirements have been verified.`
    );

    if (!confirmed) return;

    setSavingStatus(true);
    setMessage("");

    try {
      const result = await patientLifecycleWorkflow({
        operationId: `patient-destroy-${patient.id}`,
        patientId: patient.id,
        action: "destroy",
        reason: "Destroyed from patient detail page after retention confirmation.",
        confirmationToken: `DESTROY-${patient.id}`,
      });
      if (result.status !== "success" && result.status !== "duplicate_operation") {
        throw new Error(result.message || "Patient destroy workflow failed.");
      }

      setMessage(`${patient.fullName} marked as destroyed.`);
    } catch (error) {
      console.error("DESTROY PATIENT ERROR:", error);
      setMessage("Could not destroy patient. Check Firestore permissions.");
    } finally {
      setSavingStatus(false);
    }
  }

  if (loading) {
    return <LoadingState />;
  }

  if (!patient) {
    return (
      <PageShell>
        <GlassPanel>
          <button
            type="button"
            onClick={() => router.back()}
            className={`mb-4 inline-flex items-center gap-2 text-sm ${typography.bodyMuted} transition hover:${colors.textPrimary}`}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <p className={typography.bodyMuted}>Patient record not found.</p>
        </GlassPanel>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PatientDetailHeader
        patient={patient}
        riskScore={riskScore}
        savingStatus={savingStatus}
        archivePatient={archivePatient}
        restorePatient={restorePatient}
        destroyPatient={destroyPatient}
      />

      {message ? (
        <div className={`${glass.panelPadded} flex items-start justify-between gap-3 text-sm shadow-xl shadow-black/20 backdrop-blur-2xl`}>
          <p>{message}</p>

          <button
            type="button"
            onClick={() => setMessage("")}
            className={`rounded-xl p-1 ${typography.bodyMuted} transition hover:${colors.surfaceHover} hover:${colors.textPrimary}`}
            aria-label="Dismiss message"
            title="Dismiss message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <PatientRecordTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === "order" ? (
        <OrderTab
          patient={patient}
          openTasks={openTasks}
          riskScore={riskScore}
          riskFlags={riskFlags}
          birthdayInfo={birthdayInfo}
        />
      ) : null}

      {activeTab === "clinical" ? (
        <ClinicalTab patient={patient} />
      ) : null}

      {activeTab === "insurance" ? (
        <InsuranceTab patient={patient} />
      ) : null}

      {activeTab === "patient-responsibility" ? (
        <PatientResponsibilityTab patient={patient} />
      ) : null}

      {activeTab === "items" ? (
        <ItemsTab patient={patient} />
      ) : null}

      {activeTab === "schedule" ? (
        <ScheduleTab
          patient={patient}
          taskProps={{
            openTasks,
            completedTasks,
            savingTask,
            newTaskTitle,
            setNewTaskTitle,
            newTaskAssignedTo,
            setNewTaskAssignedTo,
            newTaskDueDate,
            setNewTaskDueDate,
            newTaskPriority,
            setNewTaskPriority,
            addTask,
            updateTaskStatus,
          }}
        />
      ) : null}

      {activeTab === "messages" ? (
        <MessagesTab
          patient={patient}
          notesProps={{
            notesDraft,
            setNotesDraft,
            careNotesDraft,
            setCareNotesDraft,
            equipmentNotesDraft,
            setEquipmentNotesDraft,
            billingNotesDraft,
            setBillingNotesDraft,
            savingNotes,
            saveNotes,
          }}
        />
      ) : null}

      {activeTab === "custom-fields" ? (
        <CustomFieldsTab patient={patient} />
      ) : null}

      {activeTab === "history" ? (
        <HistoryTab patient={patient} />
      ) : null}

      <PatientRecordTabs activeTab={activeTab} setActiveTab={setActiveTab} />
    </PageShell>
  );
}

function PatientRecordTabs({
  activeTab,
  setActiveTab,
}: {
  activeTab: PatientRecordTab;
  setActiveTab: (tab: PatientRecordTab) => void;
}) {
  return (
    <GlassPanel>
      <div
        role="tablist"
        aria-label="Patient record sections"
        className="flex flex-wrap gap-2"
      >
        {patientRecordTabs.map((tab) => {
          const selected = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected ? "true" : "false"}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "inline-flex min-h-11 min-w-0 items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                selected
                  ? "border-cyan-300/45 bg-cyan-300/15 text-white shadow-lg shadow-cyan-950/30"
                  : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-200/30 hover:bg-white/[0.08] hover:text-white",
              ].join(" ")}
            >
              <span className="shrink-0 text-cyan-200">{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}
