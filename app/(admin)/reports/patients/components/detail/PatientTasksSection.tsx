"use client";

import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Plus,
} from "lucide-react";

import type { PatientTaskPriority } from "../../lib/patientTypes";
import { formatDate } from "../../lib/patientUtils";
import {
  EmptyState,
  Input,
  Section,
  TaskPriorityPill,
} from "../PatientUI";
import type { PatientDetailProps } from "./patient-detail-types";

export function PatientTasksSection({
  selected,
  savingTask,
  newTaskTitle,
  newTaskAssignedTo,
  newTaskDueDate,
  newTaskPriority,
  setNewTaskTitle,
  setNewTaskAssignedTo,
  setNewTaskDueDate,
  setNewTaskPriority,
  addTask,
  updateTaskStatus,
}: Pick<
  PatientDetailProps,
  | "selected"
  | "savingTask"
  | "newTaskTitle"
  | "newTaskAssignedTo"
  | "newTaskDueDate"
  | "newTaskPriority"
  | "setNewTaskTitle"
  | "setNewTaskAssignedTo"
  | "setNewTaskDueDate"
  | "setNewTaskPriority"
  | "addTask"
  | "updateTaskStatus"
>) {
  const openTasks =
    selected.tasks?.filter((task) => task.status === "open") ?? [];

  return (
    <Section
      title="Care Coordination Tasks"
      icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
    >
      <div className="space-y-4 md:col-span-3">
        <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl md:grid-cols-4">
          <Input
            label="Task Title"
            value={newTaskTitle}
            onChange={setNewTaskTitle}
            placeholder="Example: Follow up on PAR renewal"
          />

          <Input
            label="Assigned To"
            value={newTaskAssignedTo}
            onChange={setNewTaskAssignedTo}
            placeholder="Staff member"
          />

          <Input
            label="Due Date"
            type="date"
            value={newTaskDueDate}
            onChange={setNewTaskDueDate}
          />

          <label>
            <span className="mb-2 block text-xs text-zinc-400">Priority</span>
            <select
              title="Task priority"
              aria-label="Task priority"
              value={newTaskPriority}
              onChange={(event) =>
                setNewTaskPriority(event.target.value as PatientTaskPriority)
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 p-3 text-sm text-white outline-none backdrop-blur-xl transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
            >
              <option value="routine">Routine</option>
              <option value="watch">Watch</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => void addTask(selected)}
            disabled={savingTask}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-100 shadow-[0_12px_30px_rgba(37,99,235,0.15)] transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-4"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {savingTask ? "Saving Task..." : "Add Task"}
          </button>
        </div>

        {openTasks.length ? (
          <div className="space-y-2">
            {openTasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{task.title}</p>
                    <TaskPriorityPill priority={task.priority} />
                  </div>

                  <p className="mt-1 text-xs text-zinc-400">
                    Assigned: {task.assignedTo || "â€”"} | Due:{" "}
                    {formatDate(task.dueDate)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void updateTaskStatus(selected, task.id, "done")}
                  disabled={savingTask}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Mark Done
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
            title="No open tasks"
            message="No open care coordination tasks are indexed for this patient."
          />
        )}
      </div>
    </Section>
  );
}


