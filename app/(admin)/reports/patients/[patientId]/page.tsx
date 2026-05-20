"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardCheck,
  NotebookPen,
  X,
} from "lucide-react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

import { addTimelineEntry, writeAuditLog } from "./patient-detail-actions";
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

import { PatientBirthdayPanel } from "./components/PatientBirthdayPanel";
import { PatientDetailHeader } from "./components/PatientDetailHeader";
import {
  GlassPanel,
  LoadingState,
  PageShell,
  RecordCompletePanel,
  RiskFlagPanel,
  Section,
} from "./components/PatientDetailPrimitives";
import { PatientInfoSections } from "./components/PatientInfoSections";
import { PatientNotesSection } from "./components/PatientNotesSection";
import { PatientReportSources } from "./components/PatientReportSources";
import { PatientRetentionSection } from "./components/PatientRetentionSection";
import { PatientStatsGrid } from "./components/PatientStatsGrid";
import { PatientTasksSection } from "./components/PatientTasksSection";

export default function PatientDetailPage() {
  const params = useParams<{ patientId: string }>();
  const router = useRouter();

  const patientId = params.patientId;

  const { patient, loading, message, setMessage } = usePatientDetail(patientId);

  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

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
  }, [patient?.id]);

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
      await updateDoc(doc(db, PATIENTS_COLLECTION, patient.id), {
        status: "archived",
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await writeAuditLog({
        action: "patient_archived",
        patient,
        previousStatus: patient.status,
        newStatus: "archived",
      });

      await addTimelineEntry({
        patientId: patient.id,
        type: "patient_archived",
        title: "Patient archived",
      });

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
      await updateDoc(doc(db, PATIENTS_COLLECTION, patient.id), {
        status: "active",
        restoredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await writeAuditLog({
        action: "patient_restored",
        patient,
        previousStatus: patient.status,
        newStatus: "active",
      });

      await addTimelineEntry({
        patientId: patient.id,
        type: "patient_restored",
        title: "Patient restored",
      });

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
      await updateDoc(doc(db, PATIENTS_COLLECTION, patient.id), {
        status: "destroyed",
        destroyedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await writeAuditLog({
        action: "patient_destroyed",
        patient,
        previousStatus: patient.status,
        newStatus: "destroyed",
      });

      await addTimelineEntry({
        patientId: patient.id,
        type: "patient_destroyed",
        title: "Patient marked destroyed",
      });

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
            className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <p className="text-zinc-400">Patient record not found.</p>
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
        <div className="flex items-start justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.075] p-4 text-sm text-zinc-200 shadow-xl shadow-black/20 backdrop-blur-2xl">
          <p>{message}</p>

          <button
            type="button"
            onClick={() => setMessage("")}
            className="rounded-xl p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Dismiss message"
            title="Dismiss message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {riskFlags.length ? (
        <RiskFlagPanel flags={riskFlags} />
      ) : (
        <RecordCompletePanel />
      )}

      {birthdayInfo ? (
        <PatientBirthdayPanel
          fullName={patient.fullName}
          isThisMonth={birthdayInfo.isThisMonth}
          birthday={birthdayInfo.birthday}
          ageTurning={birthdayInfo.ageTurning}
        />
      ) : null}

      <PatientStatsGrid
        patient={patient}
        openTasks={openTasks}
        riskScore={riskScore}
      />

      <PatientInfoSections patient={patient} />

      <Section
        title="Care Coordination Tasks"
        icon={<CalendarClock className="h-5 w-5" />}
      >
        <PatientTasksSection
          openTasks={openTasks}
          completedTasks={completedTasks}
          savingTask={savingTask}
          newTaskTitle={newTaskTitle}
          setNewTaskTitle={setNewTaskTitle}
          newTaskAssignedTo={newTaskAssignedTo}
          setNewTaskAssignedTo={setNewTaskAssignedTo}
          newTaskDueDate={newTaskDueDate}
          setNewTaskDueDate={setNewTaskDueDate}
          newTaskPriority={newTaskPriority}
          setNewTaskPriority={setNewTaskPriority}
          addTask={addTask}
          updateTaskStatus={updateTaskStatus}
        />
      </Section>

      <Section title="Internal Notes" icon={<NotebookPen className="h-5 w-5" />}>
        <PatientNotesSection
          notesDraft={notesDraft}
          setNotesDraft={setNotesDraft}
          careNotesDraft={careNotesDraft}
          setCareNotesDraft={setCareNotesDraft}
          equipmentNotesDraft={equipmentNotesDraft}
          setEquipmentNotesDraft={setEquipmentNotesDraft}
          billingNotesDraft={billingNotesDraft}
          setBillingNotesDraft={setBillingNotesDraft}
          savingNotes={savingNotes}
          saveNotes={saveNotes}
        />
      </Section>

      <PatientRetentionSection patient={patient} />

      <PatientReportSources reportTypes={patient.reportTypes} />
    </PageShell>
  );
}