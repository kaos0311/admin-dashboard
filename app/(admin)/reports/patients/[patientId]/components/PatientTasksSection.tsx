"use client";

import { CheckCircle2, ClipboardCheck, Plus } from "lucide-react";

import type {
  PatientTask,
  PatientTaskPriority,
  PatientTaskStatus,
} from "../patient-detail-types";

import {
  EmptyState,
  StatusSmall,
  SuccessIcon,
  TaskPriorityPill,
} from "./PatientDetailPrimitives";

import { formatDate } from "../patient-detail-utils";

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: "text" | "date";
}) {
  const id = `input-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <label htmlFor={id}>
      <span className="mb-2 block text-xs text-zinc-400">{label}</span>

      <input
        id={id}
        title={label}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-400/30"
      />
    </label>
  );
}

function TaskList({
  tasks,
  saving,
  onChangeStatus,
  actionLabel,
  nextStatus,
}: {
  tasks: PatientTask[];
  saving: boolean;
  onChangeStatus: (
    taskId: string,
    status: PatientTaskStatus
  ) => Promise<void>;
  actionLabel: string;
  nextStatus: PatientTaskStatus;
}) {
  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/25 p-4 backdrop-blur-xl md:flex-row md:items-center md:justify-between"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-white">{task.title}</p>

              <TaskPriorityPill priority={task.priority} />

              <StatusSmall label={task.status} />
            </div>

            <p className="mt-1 text-xs text-zinc-400">
              Assigned: {task.assignedTo || "—"} | Due:{" "}
              {formatDate(task.dueDate)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void onChangeStatus(task.id, nextStatus)}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {actionLabel}
          </button>
        </div>
      ))}
    </div>
  );
}

type Props = {
  openTasks: PatientTask[];
  completedTasks: PatientTask[];

  savingTask: boolean;

  newTaskTitle: string;
  setNewTaskTitle: (value: string) => void;

  newTaskAssignedTo: string;
  setNewTaskAssignedTo: (value: string) => void;

  newTaskDueDate: string;
  setNewTaskDueDate: (value: string) => void;

  newTaskPriority: PatientTaskPriority;
  setNewTaskPriority: (value: PatientTaskPriority) => void;

  addTask: () => Promise<void>;

  updateTaskStatus: (
    taskId: string,
    status: PatientTaskStatus
  ) => Promise<void>;
};

export function PatientTasksSection(props: Props) {
  return (
    <div className="space-y-4 md:col-span-3">
      <div className="grid gap-3 rounded-3xl border border-white/10 bg-black/25 p-4 backdrop-blur-2xl md:grid-cols-4">
        <Input
          label="Task Title"
          value={props.newTaskTitle}
          onChange={props.setNewTaskTitle}
          placeholder="Example: Follow up on PAR renewal"
        />

        <Input
          label="Assigned To"
          value={props.newTaskAssignedTo}
          onChange={props.setNewTaskAssignedTo}
          placeholder="Staff member"
        />

        <Input
          label="Due Date"
          type="date"
          value={props.newTaskDueDate}
          onChange={props.setNewTaskDueDate}
        />

        <label>
          <span className="mb-2 block text-xs text-zinc-400">
            Priority
          </span>

          <select
            title="Task priority"
            aria-label="Task priority"
            value={props.newTaskPriority}
            onChange={(event) =>
              props.setNewTaskPriority(
                event.target.value as PatientTaskPriority
              )
            }
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none"
          >
            <option value="routine">Routine</option>
            <option value="watch">Watch</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => void props.addTask()}
          disabled={props.savingTask}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-4"
        >
          <Plus className="h-4 w-4" />

          {props.savingTask ? "Saving Task..." : "Add Task"}
        </button>
      </div>

      {props.openTasks.length ? (
        <TaskList
          tasks={props.openTasks}
          saving={props.savingTask}
          onChangeStatus={props.updateTaskStatus}
          actionLabel="Mark Done"
          nextStatus="done"
        />
      ) : (
        <EmptyState
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="No open tasks"
          message="No open care coordination tasks are indexed for this patient."
        />
      )}

      {props.completedTasks.length ? (
        <details className="rounded-3xl border border-white/10 bg-black/25 p-4 backdrop-blur-2xl">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-300">
            Completed Tasks ({props.completedTasks.length})
          </summary>

          <div className="mt-4">
            <TaskList
              tasks={props.completedTasks}
              saving={props.savingTask}
              onChangeStatus={props.updateTaskStatus}
              actionLabel="Reopen"
              nextStatus="open"
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}