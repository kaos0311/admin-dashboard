"use client";

import { CheckCircle2, ClipboardCheck, Plus } from "lucide-react";

import { buttons, forms, glass, typography } from "@/theme";

import type {
  PatientTask,
  PatientTaskPriority,
  PatientTaskStatus,
} from "../patient-detail-types";

import {
  EmptyState,
  StatusSmall,
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
      <span className={typography.label}>{label}</span>

      <input
        id={id}
        title={label}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${forms.input} mt-2`}
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
          className={`${glass.inset} flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between`}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className={typography.cardTitle}>{task.title}</p>

              <TaskPriorityPill priority={task.priority} />

              <StatusSmall label={task.status} />
            </div>

            <p className={`${typography.caption} mt-1`}>
              Assigned: {task.assignedTo || "—"} | Due:{" "}
              {formatDate(task.dueDate)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void onChangeStatus(task.id, nextStatus)}
            disabled={saving}
            className={buttons.success}
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
      <div className={`${glass.inset} grid gap-3 p-4 md:grid-cols-4`}>
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
          <span className={typography.label}>
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
            className={`${forms.select} mt-2`}
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
          className={`${buttons.primary} md:col-span-4`}
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
        <details className={`${glass.inset} p-4`}>
          <summary className={`${typography.cardTitle} cursor-pointer`}>
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
